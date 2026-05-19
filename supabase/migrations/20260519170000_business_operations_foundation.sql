-- Business Operations Platform - Foundation Schema
-- This migration creates the essential tables for a business operations platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'canceled', 'unpaid', 'past_due');
CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'professional', 'enterprise');
CREATE TYPE business_type AS ENUM ('home_services', 'restaurant', 'professional_services', 'medical', 'retail', 'consulting', 'agency', 'other');
CREATE TYPE communication_channel AS ENUM ('phone', 'sms', 'email', 'web_chat', 'whatsapp');
CREATE TYPE workflow_status AS ENUM ('active', 'paused', 'archived');

-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business profiles for service businesses
CREATE TABLE business_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    business_type business_type NOT NULL,
    description TEXT,
    website TEXT,
    phone TEXT,
    email TEXT,
    address JSONB, -- Structured address data
    business_hours JSONB, -- Operating hours structure
    settings JSONB DEFAULT '{}', -- Business-specific settings
    ai_personality JSONB DEFAULT '{}', -- AI assistant personality settings
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_id UUID REFERENCES business_profiles(id) ON DELETE SET NULL,
    tier subscription_tier NOT NULL DEFAULT 'free',
    status subscription_status NOT NULL DEFAULT 'trialing',
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communication logs to track all AI interactions
CREATE TABLE communication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    customer_phone TEXT,
    customer_email TEXT,
    customer_name TEXT,
    channel communication_channel NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_content TEXT,
    ai_response TEXT,
    sentiment_score DECIMAL(3,2), -- -1.00 to 1.00
    handled_by_ai BOOLEAN DEFAULT true,
    escalated_to_human BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}', -- Channel-specific data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer profiles managed by businesses
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    external_id TEXT, -- Business's own customer ID
    name TEXT,
    email TEXT,
    phone TEXT,
    address JSONB,
    preferences JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    lifetime_value DECIMAL(10,2) DEFAULT 0,
    last_contact TIMESTAMPTZ,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments and scheduling
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    location TEXT,
    staff_member TEXT,
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow templates and automations
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- 'appointment_booked', 'customer_inquiry', 'payment_received', etc.
    trigger_conditions JSONB DEFAULT '{}',
    actions JSONB NOT NULL, -- Array of actions to execute
    status workflow_status DEFAULT 'active',
    execution_count INTEGER DEFAULT 0,
    last_executed TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking for billing and analytics
CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL, -- 'ai_interactions', 'appointments_scheduled', 'workflows_executed'
    metric_value INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    billing_period TEXT -- YYYY-MM format for monthly billing
);

-- Integration configurations
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL, -- 'google_calendar', 'stripe', 'mailchimp', etc.
    configuration JSONB NOT NULL, -- Encrypted connection details
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'connected',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_business_profiles_owner_id ON business_profiles(owner_id);
CREATE INDEX idx_business_profiles_business_type ON business_profiles(business_type);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_communication_logs_business_id ON communication_logs(business_id);
CREATE INDEX idx_communication_logs_created_at ON communication_logs(created_at DESC);
CREATE INDEX idx_customers_business_id ON customers(business_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_appointments_business_id ON appointments(business_id);
CREATE INDEX idx_appointments_start_time ON appointments(start_time);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_workflows_business_id ON workflows(business_id);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_usage_metrics_business_id_period ON usage_metrics(business_id, billing_period);
CREATE INDEX idx_integrations_business_id ON integrations(business_id);

-- Row Level Security (RLS) policies

-- Profiles: Users can only access their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Business profiles: Users can access businesses they own
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own businesses" ON business_profiles FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own businesses" ON business_profiles FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own businesses" ON business_profiles FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own businesses" ON business_profiles FOR DELETE USING (auth.uid() = owner_id);

-- Subscriptions: Users can access their own subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- Communication logs: Business owners can access their logs
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owners can view communication logs" ON communication_logs FOR SELECT
    USING (auth.uid() IN (SELECT owner_id FROM business_profiles WHERE id = business_id));
CREATE POLICY "Business owners can insert communication logs" ON communication_logs FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT owner_id FROM business_profiles WHERE id = business_id));

-- Customers: Business owners can manage their customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owners can manage customers" ON customers FOR ALL
    USING (auth.uid() IN (SELECT owner_id FROM business_profiles WHERE id = business_id));

-- Appointments: Business owners can manage their appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owners can manage appointments" ON appointments FOR ALL
    USING (auth.uid() IN (SELECT owner_id FROM business_profiles WHERE id = business_id));

-- Workflows: Business owners can manage their workflows
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owners can manage workflows" ON workflows FOR ALL
    USING (auth.uid() IN (SELECT owner_id FROM business_profiles WHERE id = business_id));

-- Usage metrics: Business owners can view their usage
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owners can view usage metrics" ON usage_metrics FOR SELECT
    USING (auth.uid() IN (SELECT owner_id FROM business_profiles WHERE id = business_id));
CREATE POLICY "System can insert usage metrics" ON usage_metrics FOR INSERT
    WITH CHECK (true); -- Allow system to insert usage metrics

-- Integrations: Business owners can manage their integrations
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owners can manage integrations" ON integrations FOR ALL
    USING (auth.uid() IN (SELECT owner_id FROM business_profiles WHERE id = business_id));

-- Functions for common operations

-- Function to get user's subscription tier
CREATE OR REPLACE FUNCTION get_user_subscription_tier(user_uuid UUID)
RETURNS subscription_tier
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_tier subscription_tier;
BEGIN
    SELECT tier INTO user_tier
    FROM subscriptions
    WHERE user_id = user_uuid
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > NOW())
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN COALESCE(user_tier, 'free');
END;
$$;

-- Function to track usage metrics
CREATE OR REPLACE FUNCTION track_usage(
    business_uuid UUID,
    metric_name TEXT,
    metric_count INTEGER DEFAULT 1,
    extra_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_period TEXT;
BEGIN
    current_period := TO_CHAR(NOW(), 'YYYY-MM');

    INSERT INTO usage_metrics (business_id, metric_type, metric_value, metadata, billing_period)
    VALUES (business_uuid, metric_name, metric_count, extra_metadata, current_period);
END;
$$;

-- Function to create default business profile after user signup
CREATE OR REPLACE FUNCTION create_default_business_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Create default business profile
    INSERT INTO business_profiles (owner_id, business_name, business_type)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Business'),
        COALESCE((NEW.raw_user_meta_data->>'business_type')::business_type, 'other')
    );

    -- Create free subscription
    INSERT INTO subscriptions (user_id, tier, status)
    VALUES (NEW.id, 'free', 'active');

    RETURN NEW;
END;
$$;

-- Trigger to create business profile on user signup
CREATE TRIGGER on_auth_user_created_business_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_default_business_profile();

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply update triggers to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_business_profiles_updated_at BEFORE UPDATE ON business_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for development
INSERT INTO profiles (id, email, full_name) VALUES
    ('00000000-0000-0000-0000-000000000001', 'demo@example.com', 'Demo User')
ON CONFLICT (id) DO NOTHING;