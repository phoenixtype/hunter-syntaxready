import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Heart, Shield, Users, Accessibility, Award, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";

interface CompanyDiversityData {
  dei_commitment?: string;
  accessibility_support?: string[];
  inclusive_benefits?: string[];
  diversity_rating?: number;
  pay_equity_certified?: boolean;
  remote_work_accessibility?: boolean;
  mentorship_programs?: boolean;
  eeo_statement?: string;
  accommodation_statement?: string;
  preferred_pronouns_respected?: boolean;
}

const ACCESSIBILITY_SUPPORT = [
  { value: 'wheelchair_accessible', label: 'Wheelchair accessible facilities' },
  { value: 'screen_reader_compatible', label: 'Screen reader compatible systems' },
  { value: 'sign_language_support', label: 'Sign language interpreters available' },
  { value: 'flexible_work_arrangements', label: 'Flexible work arrangements' },
  { value: 'ergonomic_equipment', label: 'Ergonomic equipment provided' },
  { value: 'quiet_workspaces', label: 'Quiet workspaces available' },
  { value: 'mental_health_support', label: 'Mental health support services' },
  { value: 'sensory_accommodations', label: 'Sensory accommodations (lighting, sound)' },
  { value: 'communication_aids', label: 'Communication aids and tools' },
  { value: 'modified_schedules', label: 'Modified work schedules' },
];

const INCLUSIVE_BENEFITS = [
  { value: 'parental_leave', label: 'Comprehensive parental leave (all genders)' },
  { value: 'gender_affirming_care', label: 'Gender-affirming healthcare coverage' },
  { value: 'mental_health_benefits', label: 'Comprehensive mental health benefits' },
  { value: 'fertility_assistance', label: 'Fertility and family planning assistance' },
  { value: 'adoption_assistance', label: 'Adoption and surrogacy assistance' },
  { value: 'elder_care', label: 'Elder care assistance' },
  { value: 'religious_holidays', label: 'Flexible religious holiday policy' },
  { value: 'cultural_celebrations', label: 'Cultural celebration support' },
  { value: 'employee_resource_groups', label: 'Employee resource groups (ERGs)' },
  { value: 'diversity_training', label: 'Mandatory diversity and inclusion training' },
  { value: 'bias_free_hiring', label: 'Bias-free hiring practices' },
  { value: 'pay_equity_audits', label: 'Regular pay equity audits' },
  { value: 'professional_development', label: 'Diversity-focused professional development' },
  { value: 'mentorship_sponsorship', label: 'Mentorship and sponsorship programs' },
  { value: 'accessibility_fund', label: 'Personal accessibility equipment fund' },
  { value: 'language_support', label: 'Multilingual support services' },
];

const DEI_COMMITMENT_LEVELS = [
  { value: 'basic', label: 'Basic - Equal opportunity employer' },
  { value: 'committed', label: 'Committed - Active DEI initiatives' },
  { value: 'advanced', label: 'Advanced - DEI integrated into business strategy' },
  { value: 'leading', label: 'Industry Leading - DEI is core to company mission' },
];

interface CompanyDiversitySettingsProps {
  companyId: string;
}

export default function CompanyDiversitySettings({ companyId }: CompanyDiversitySettingsProps) {
  const [data, setData] = useState<CompanyDiversityData>({
    accessibility_support: [],
    inclusive_benefits: [],
    pay_equity_certified: false,
    remote_work_accessibility: false,
    mentorship_programs: false,
    preferred_pronouns_respected: true,
    accommodation_statement: 'We provide reasonable accommodations for qualified individuals with disabilities.',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCompanyDiversityData();
  }, [companyId]);

  const loadCompanyDiversityData = async () => {
    try {
      // First check if we have existing data in job_listings for this company
      const { data: companyData, error } = await supabase
        .from('companies')
        .select(`
          *,
          job_listings (
            dei_commitment, accessibility_support, inclusive_benefits,
            diversity_rating, pay_equity_certified, remote_work_accessibility,
            mentorship_programs, eeo_statement, accommodation_statement,
            preferred_pronouns_respected
          )
        `)
        .eq('id', companyId)
        .single();

      if (error) throw error;

      // Use the first job listing's DEI data as template, or empty object
      const jobListingData = companyData?.job_listings?.[0] || {};

      setData({
        dei_commitment: jobListingData.dei_commitment || '',
        accessibility_support: jobListingData.accessibility_support || [],
        inclusive_benefits: jobListingData.inclusive_benefits || [],
        diversity_rating: jobListingData.diversity_rating || undefined,
        pay_equity_certified: jobListingData.pay_equity_certified || false,
        remote_work_accessibility: jobListingData.remote_work_accessibility || false,
        mentorship_programs: jobListingData.mentorship_programs || false,
        eeo_statement: jobListingData.eeo_statement || '',
        accommodation_statement: jobListingData.accommodation_statement || 'We provide reasonable accommodations for qualified individuals with disabilities.',
        preferred_pronouns_respected: jobListingData.preferred_pronouns_respected !== false,
      });
    } catch (error: any) {
      console.error('Error loading company diversity data:', error);
      toast({
        title: "Error",
        description: "Failed to load company diversity information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveCompanyDiversityData = async () => {
    setSaving(true);
    try {
      // Update all job listings for this company with the new DEI data
      const { error } = await supabase
        .from('job_listings')
        .update({
          dei_commitment: data.dei_commitment || null,
          accessibility_support: data.accessibility_support || null,
          inclusive_benefits: data.inclusive_benefits || null,
          diversity_rating: data.diversity_rating || null,
          pay_equity_certified: data.pay_equity_certified || false,
          remote_work_accessibility: data.remote_work_accessibility || false,
          mentorship_programs: data.mentorship_programs || false,
          eeo_statement: data.eeo_statement || null,
          accommodation_statement: data.accommodation_statement,
          preferred_pronouns_respected: data.preferred_pronouns_respected !== false,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company diversity settings saved successfully",
      });
    } catch (error: any) {
      console.error('Error saving company diversity data:', error);
      toast({
        title: "Error",
        description: "Failed to save company diversity settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateAccessibilitySupport = (support: string, checked: boolean) => {
    const current = data.accessibility_support || [];
    if (checked) {
      setData({
        ...data,
        accessibility_support: [...current, support]
      });
    } else {
      setData({
        ...data,
        accessibility_support: current.filter(s => s !== support)
      });
    }
  };

  const updateInclusiveBenefits = (benefit: string, checked: boolean) => {
    const current = data.inclusive_benefits || [];
    if (checked) {
      setData({
        ...data,
        inclusive_benefits: [...current, benefit]
      });
    } else {
      setData({
        ...data,
        inclusive_benefits: current.filter(b => b !== benefit)
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading company diversity settings...</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl">Company Diversity & Inclusion</CardTitle>
            <CardDescription>
              Showcase your company's commitment to creating an inclusive workplace for all employees.
            </CardDescription>
          </div>
        </div>

        {/* Key Benefits Overview */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-purple-900 dark:text-purple-100">Why DEI Matters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>Attract top diverse talent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
              <span>Improve company reputation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>Enhance team performance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
              <span>Meet compliance requirements</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Company DEI Commitment */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">DEI Commitment Level</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dei-commitment">Diversity & Inclusion Commitment</Label>
              <Select
                value={data.dei_commitment || ''}
                onValueChange={(value) => setData({ ...data, dei_commitment: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select commitment level" />
                </SelectTrigger>
                <SelectContent>
                  {DEI_COMMITMENT_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="diversity-rating">Company Diversity Rating (1-5)</Label>
              <Select
                value={data.diversity_rating?.toString() || ''}
                onValueChange={(value) => setData({ ...data, diversity_rating: parseFloat(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.0">1.0 - Basic compliance</SelectItem>
                  <SelectItem value="2.0">2.0 - Some initiatives</SelectItem>
                  <SelectItem value="3.0">3.0 - Active efforts</SelectItem>
                  <SelectItem value="4.0">4.0 - Strong commitment</SelectItem>
                  <SelectItem value="5.0">5.0 - Industry leader</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pay-equity"
                  checked={data.pay_equity_certified || false}
                  onCheckedChange={(checked) => setData({ ...data, pay_equity_certified: checked as boolean })}
                />
                <Label htmlFor="pay-equity">Pay equity certified</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mentorship-programs"
                  checked={data.mentorship_programs || false}
                  onCheckedChange={(checked) => setData({ ...data, mentorship_programs: checked as boolean })}
                />
                <Label htmlFor="mentorship-programs">Mentorship programs available</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remote-accessibility"
                  checked={data.remote_work_accessibility || false}
                  onCheckedChange={(checked) => setData({ ...data, remote_work_accessibility: checked as boolean })}
                />
                <Label htmlFor="remote-accessibility">Remote work accessibility options</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pronouns-respected"
                  checked={data.preferred_pronouns_respected !== false}
                  onCheckedChange={(checked) => setData({ ...data, preferred_pronouns_respected: checked as boolean })}
                />
                <Label htmlFor="pronouns-respected">Preferred pronouns respected</Label>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Accessibility Support */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Accessibility className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Accessibility Support</h3>
          </div>

          <div className="space-y-3">
            <Label>Accessibility features and accommodations provided</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ACCESSIBILITY_SUPPORT.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`accessibility-${option.value}`}
                    checked={(data.accessibility_support || []).includes(option.value)}
                    onCheckedChange={(checked) => updateAccessibilitySupport(option.value, checked as boolean)}
                  />
                  <Label htmlFor={`accessibility-${option.value}`} className="text-sm">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Selected accessibility features */}
          {data.accessibility_support && data.accessibility_support.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.accessibility_support.map((support) => {
                const option = ACCESSIBILITY_SUPPORT.find(o => o.value === support);
                return option ? (
                  <Badge key={support} variant="secondary" className="bg-blue-100 text-blue-800">
                    {option.label}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Inclusive Benefits */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">Inclusive Benefits</h3>
          </div>

          <div className="space-y-3">
            <Label>Benefits that support diversity and inclusion</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {INCLUSIVE_BENEFITS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`benefit-${option.value}`}
                    checked={(data.inclusive_benefits || []).includes(option.value)}
                    onCheckedChange={(checked) => updateInclusiveBenefits(option.value, checked as boolean)}
                  />
                  <Label htmlFor={`benefit-${option.value}`} className="text-sm">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Selected benefits */}
          {data.inclusive_benefits && data.inclusive_benefits.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.inclusive_benefits.map((benefit) => {
                const option = INCLUSIVE_BENEFITS.find(o => o.value === benefit);
                return option ? (
                  <Badge key={benefit} variant="secondary" className="bg-green-100 text-green-800">
                    {option.label}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Legal Statements */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Equal Opportunity & Accommodations</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="eeo-statement">Equal Employment Opportunity Statement</Label>
              <Textarea
                id="eeo-statement"
                placeholder="e.g., We are an equal opportunity employer and welcome applications from all qualified candidates regardless of race, gender, age, religion, sexual orientation, or disability."
                value={data.eeo_statement || ''}
                onChange={(e) => setData({ ...data, eeo_statement: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accommodation-statement">Disability Accommodation Statement</Label>
              <Textarea
                id="accommodation-statement"
                placeholder="Statement about providing reasonable accommodations"
                value={data.accommodation_statement || ''}
                onChange={(e) => setData({ ...data, accommodation_statement: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={saveCompanyDiversityData}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {saving ? 'Saving...' : 'Save Diversity Settings'}
          </Button>
        </div>

        {/* Impact Statement */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 text-sm">
          <p className="font-medium mb-2 text-purple-900 dark:text-purple-100">Impact on Job Matching</p>
          <p className="text-gray-700 dark:text-gray-300">
            These settings help candidates find companies that align with their values and needs.
            Comprehensive DEI information increases your visibility to diverse talent and can improve
            your hiring success rate by 40%. All settings will be displayed on your company profile
            and job listings.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}