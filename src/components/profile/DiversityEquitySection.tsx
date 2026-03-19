import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Heart, Shield, Users, Accessibility, Globe, GraduationCap, Flag } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DiversityEquityData {
  age?: number;
  gender?: string;
  ethnicity?: string[];
  pronouns?: string;
  disability_status?: string;
  accessibility_accommodations?: string[];
  veteran_status?: boolean;
  first_generation_college?: boolean;
  primary_language?: string;
  visa_sponsorship_required?: boolean;
  religious_accommodations?: string[];
  socioeconomic_background?: string;
  dei_preferences?: any;
  privacy_settings?: {
    share_demographics: boolean;
    share_disability_status: boolean;
    share_veteran_status: boolean;
  };
}

const ETHNICITY_OPTIONS = [
  { value: 'american_indian', label: 'American Indian / Alaska Native' },
  { value: 'asian', label: 'Asian' },
  { value: 'black_african', label: 'Black or African American' },
  { value: 'hispanic_latino', label: 'Hispanic or Latino' },
  { value: 'native_hawaiian', label: 'Native Hawaiian / Pacific Islander' },
  { value: 'white', label: 'White' },
  { value: 'middle_eastern', label: 'Middle Eastern / North African' },
  { value: 'mixed_race', label: 'Two or more races' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const PRONOUN_OPTIONS = [
  { value: 'he_him', label: 'he/him' },
  { value: 'she_her', label: 'she/her' },
];

const ACCESSIBILITY_ACCOMMODATIONS = [
  { value: 'screen_reader', label: 'Screen reader compatibility' },
  { value: 'keyboard_navigation', label: 'Keyboard-only navigation' },
  { value: 'high_contrast', label: 'High contrast displays' },
  { value: 'flexible_hours', label: 'Flexible work hours' },
  { value: 'remote_work', label: 'Remote work options' },
  { value: 'ergonomic_equipment', label: 'Ergonomic equipment' },
  { value: 'quiet_workspace', label: 'Quiet workspace' },
  { value: 'break_schedule', label: 'Flexible break schedule' },
  { value: 'sign_language', label: 'Sign language interpreter' },
  { value: 'mobility_assistance', label: 'Mobility assistance' },
];

const RELIGIOUS_ACCOMMODATIONS = [
  { value: 'prayer_time', label: 'Prayer time flexibility' },
  { value: 'religious_holidays', label: 'Religious holiday observance' },
  { value: 'dietary_requirements', label: 'Dietary requirements' },
  { value: 'dress_code', label: 'Religious dress code accommodation' },
  { value: 'worship_space', label: 'Quiet space for worship' },
];

interface DiversityEquitySectionProps {
  candidateId: string;
}

export default function DiversityEquitySection({ candidateId }: DiversityEquitySectionProps) {
  const [data, setData] = useState<DiversityEquityData>({
    privacy_settings: {
      share_demographics: false,
      share_disability_status: false,
      share_veteran_status: false
    },
    dei_preferences: {}
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDiversityData();
  }, [candidateId]);

  const loadDiversityData = async () => {
    try {
      const { data: profileData, error } = await supabase
        .from('candidate_profiles')
        .select(`
          age, gender, ethnicity, pronouns, disability_status,
          accessibility_accommodations, veteran_status, first_generation_college,
          primary_language, visa_sponsorship_required,
          religious_accommodations, socioeconomic_background,
          dei_preferences, privacy_settings
        `)
        .eq('id', candidateId)
        .single();

      if (error) throw error;

      if (profileData) {
        setData({
          ...profileData,
          privacy_settings: profileData.privacy_settings || {
            share_demographics: false,
            share_disability_status: false,
            share_veteran_status: false
          },
          dei_preferences: profileData.dei_preferences || {}
        });
      }
    } catch (error: any) {
      console.error('Error loading diversity data:', error);
      toast({
        title: "Error",
        description: "Failed to load diversity information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveDiversityData = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('candidate_profiles')
        .update({
          age: data.age || null,
          gender: data.gender || null,
          ethnicity: data.ethnicity || null,
          pronouns: data.pronouns || null,
          disability_status: data.disability_status || null,
          accessibility_accommodations: data.accessibility_accommodations || null,
          veteran_status: data.veteran_status || false,
          first_generation_college: data.first_generation_college || false,
          primary_language: data.primary_language || 'English',
          visa_sponsorship_required: data.visa_sponsorship_required || false,
          religious_accommodations: data.religious_accommodations || null,
          socioeconomic_background: data.socioeconomic_background || null,
          dei_preferences: data.dei_preferences,
          privacy_settings: data.privacy_settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Diversity information saved successfully",
      });
    } catch (error: any) {
      console.error('Error saving diversity data:', error);
      toast({
        title: "Error",
        description: "Failed to save diversity information",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateEthnicity = (ethnicity: string, checked: boolean) => {
    const current = data.ethnicity || [];
    if (checked) {
      setData({
        ...data,
        ethnicity: [...current, ethnicity]
      });
    } else {
      setData({
        ...data,
        ethnicity: current.filter(e => e !== ethnicity)
      });
    }
  };

  const updateAccommodations = (accommodation: string, checked: boolean) => {
    const current = data.accessibility_accommodations || [];
    if (checked) {
      setData({
        ...data,
        accessibility_accommodations: [...current, accommodation]
      });
    } else {
      setData({
        ...data,
        accessibility_accommodations: current.filter(a => a !== accommodation)
      });
    }
  };

  const updateReligiousAccommodations = (accommodation: string, checked: boolean) => {
    const current = data.religious_accommodations || [];
    if (checked) {
      setData({
        ...data,
        religious_accommodations: [...current, accommodation]
      });
    } else {
      setData({
        ...data,
        religious_accommodations: current.filter(a => a !== accommodation)
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading diversity information...</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl">Diversity, Equity & Inclusion</CardTitle>
            <CardDescription>
              Help us create a more inclusive workplace. All information is optional and confidential.
            </CardDescription>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-900 dark:text-blue-100">Privacy Controls</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="share-demographics" className="text-sm">Share demographic information with employers</Label>
              <Switch
                id="share-demographics"
                checked={data.privacy_settings?.share_demographics || false}
                onCheckedChange={(checked) => setData({
                  ...data,
                  privacy_settings: { ...data.privacy_settings!, share_demographics: checked }
                })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="share-disability" className="text-sm">Share accessibility needs with employers</Label>
              <Switch
                id="share-disability"
                checked={data.privacy_settings?.share_disability_status || false}
                onCheckedChange={(checked) => setData({
                  ...data,
                  privacy_settings: { ...data.privacy_settings!, share_disability_status: checked }
                })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="share-veteran" className="text-sm">Share veteran status with employers</Label>
              <Switch
                id="share-veteran"
                checked={data.privacy_settings?.share_veteran_status || false}
                onCheckedChange={(checked) => setData({
                  ...data,
                  privacy_settings: { ...data.privacy_settings!, share_veteran_status: checked }
                })}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Basic Demographics */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Demographics</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                placeholder="Optional"
                value={data.age || ''}
                onChange={(e) => setData({ ...data, age: parseInt(e.target.value) || undefined })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={data.gender || ''} onValueChange={(value) => setData({ ...data, gender: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pronouns">Pronouns</Label>
              <Select value={data.pronouns || ''} onValueChange={(value) => setData({ ...data, pronouns: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pronouns" />
                </SelectTrigger>
                <SelectContent>
                  {PRONOUN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ethnicity */}
          <div className="space-y-3">
            <Label>Race/Ethnicity (Select all that apply)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ETHNICITY_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`ethnicity-${option.value}`}
                    checked={(data.ethnicity || []).includes(option.value)}
                    onCheckedChange={(checked) => updateEthnicity(option.value, checked as boolean)}
                  />
                  <Label htmlFor={`ethnicity-${option.value}`} className="text-sm">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Selected ethnicities badges */}
          {data.ethnicity && data.ethnicity.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.ethnicity.map((eth) => {
                const option = ETHNICITY_OPTIONS.find(o => o.value === eth);
                return option ? (
                  <Badge key={eth} variant="secondary" className="bg-purple-100 text-purple-800">
                    {option.label}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Accessibility & Accommodations */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Accessibility className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Accessibility & Accommodations</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disability-status">Disability Status</Label>
              <Select
                value={data.disability_status || ''}
                onValueChange={(value) => setData({ ...data, disability_status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select if applicable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No disability</SelectItem>
                  <SelectItem value="physical">Physical disability</SelectItem>
                  <SelectItem value="cognitive">Cognitive disability</SelectItem>
                  <SelectItem value="sensory">Sensory disability</SelectItem>
                  <SelectItem value="mental_health">Mental health condition</SelectItem>
                  <SelectItem value="chronic_illness">Chronic illness</SelectItem>
                  <SelectItem value="multiple">Multiple disabilities</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Accessibility Accommodations Needed</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ACCESSIBILITY_ACCOMMODATIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`accommodation-${option.value}`}
                      checked={(data.accessibility_accommodations || []).includes(option.value)}
                      onCheckedChange={(checked) => updateAccommodations(option.value, checked as boolean)}
                    />
                    <Label htmlFor={`accommodation-${option.value}`} className="text-sm">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Religious accommodations */}
            <div className="space-y-3">
              <Label>Religious Accommodations</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {RELIGIOUS_ACCOMMODATIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`religious-${option.value}`}
                      checked={(data.religious_accommodations || []).includes(option.value)}
                      onCheckedChange={(checked) => updateReligiousAccommodations(option.value, checked as boolean)}
                    />
                    <Label htmlFor={`religious-${option.value}`} className="text-sm">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Other Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">Additional Information</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary-language">Primary Language</Label>
              <Input
                id="primary-language"
                placeholder="e.g., English, Spanish, Mandarin"
                value={data.primary_language || ''}
                onChange={(e) => setData({ ...data, primary_language: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="socioeconomic">Socioeconomic Background</Label>
              <Select
                value={data.socioeconomic_background || ''}
                onValueChange={(value) => setData({ ...data, socioeconomic_background: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low_income">Low income</SelectItem>
                  <SelectItem value="working_class">Working class</SelectItem>
                  <SelectItem value="middle_class">Middle class</SelectItem>
                  <SelectItem value="upper_middle_class">Upper middle class</SelectItem>
                  <SelectItem value="high_income">High income</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="veteran-status"
                checked={data.veteran_status || false}
                onCheckedChange={(checked) => setData({ ...data, veteran_status: checked as boolean })}
              />
              <Label htmlFor="veteran-status" className="flex items-center gap-2">
                <Flag className="w-4 h-4" />
                Veteran status
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="first-generation"
                checked={data.first_generation_college || false}
                onCheckedChange={(checked) => setData({ ...data, first_generation_college: checked as boolean })}
              />
              <Label htmlFor="first-generation" className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                First-generation college graduate
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="visa-sponsorship"
                checked={data.visa_sponsorship_required || false}
                onCheckedChange={(checked) => setData({ ...data, visa_sponsorship_required: checked as boolean })}
              />
              <Label htmlFor="visa-sponsorship">
                Requires visa sponsorship
              </Label>
            </div>
          </div>

        </div>

        <Separator />

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={saveDiversityData}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {saving ? 'Saving...' : 'Save Diversity Information'}
          </Button>
        </div>

        {/* Disclaimer */}
        <div className="bg-gray-50 dark:bg-gray-900/50 border rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300">
          <p className="font-medium mb-2">Privacy & Equal Opportunity</p>
          <p>
            This information is used to promote workplace diversity and inclusion.
            It will not be used to discriminate against you in any way. You can control
            what information is shared with employers using the privacy settings above.
            All fields are optional and you can update or remove this information at any time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}