// Templates and offsets are source-controlled and ship with the app build.
// If/when users need to edit templates themselves, the v2 path is to move this
// to a `milestone_templates` Supabase table (with RLS) and read it via a service.

export type ConstructionPhaseId =
  | 'kupnja_zemljista'
  | 'ishodjenje_dozvola'
  | 'gradnja'
  | 'uporabna_etaziranje'

export interface MilestoneTemplateItem {
  name: string
  offsetDays: number
}

export interface MilestoneTemplatePhase {
  id: ConstructionPhaseId
  labelKey: string
  phaseLabel: string
  items: MilestoneTemplateItem[]
}

export interface MilestoneTemplate {
  id: 'residential_hr'
  labelKey: string
  phases: MilestoneTemplatePhase[]
}

export const RESIDENTIAL_HR_TEMPLATE: MilestoneTemplate = {
  id: 'residential_hr',
  labelKey: 'general_projects.milestone_template.templates.residential_hr',
  phases: [
    {
      id: 'kupnja_zemljista',
      labelKey: 'general_projects.milestone_template.phases.kupnja_zemljista',
      phaseLabel: 'Kupnja zemljišta',
      items: [
        { name: 'Predugovor o kupoprodaji', offsetDays: 0 },
        { name: 'Uplata kapare', offsetDays: 7 },
        { name: 'Pravna provjera (due diligence)', offsetDays: 14 },
        { name: 'Glavni ugovor o kupoprodaji', offsetDays: 30 },
        { name: 'Isplata pune kupoprodajne cijene', offsetDays: 45 },
        { name: 'Upis u zemljišne knjige', offsetDays: 75 }
      ]
    },
    {
      id: 'ishodjenje_dozvola',
      labelKey: 'general_projects.milestone_template.phases.ishodjenje_dozvola',
      phaseLabel: 'Ishođenje dozvola',
      items: [
        { name: 'Idejni projekt', offsetDays: 90 },
        { name: 'Posebni uvjeti gradnje', offsetDays: 120 },
        { name: 'Glavni projekt', offsetDays: 180 },
        { name: 'Tehnička kontrola', offsetDays: 210 },
        { name: 'Građevinska dozvola', offsetDays: 240 },
        { name: 'Komunalni doprinos', offsetDays: 250 },
        { name: 'Izvedbeni projekt', offsetDays: 280 },
        { name: 'Tenderiranje izvođača', offsetDays: 300 },
        { name: 'Ugovori s izvođačima', offsetDays: 330 }
      ]
    },
    {
      id: 'gradnja',
      labelKey: 'general_projects.milestone_template.phases.gradnja',
      phaseLabel: 'Gradnja',
      items: [
        { name: 'Prijava početka građenja', offsetDays: 340 },
        { name: 'Pripremni radovi', offsetDays: 350 },
        { name: 'Temelji', offsetDays: 380 },
        { name: 'Gruba gradnja', offsetDays: 470 },
        { name: 'Krov', offsetDays: 540 },
        { name: 'Fasada', offsetDays: 600 },
        { name: 'Instalacije', offsetDays: 630 },
        { name: 'Završni radovi', offsetDays: 690 },
        { name: 'Uređenje okoliša', offsetDays: 720 },
        { name: 'Tehnički pregled', offsetDays: 750 }
      ]
    },
    {
      id: 'uporabna_etaziranje',
      labelKey: 'general_projects.milestone_template.phases.uporabna_etaziranje',
      phaseLabel: 'Uporabna dozvola i etažiranje',
      items: [
        { name: 'Geodetski elaborat', offsetDays: 760 },
        { name: 'Uporabna dozvola', offsetDays: 800 },
        { name: 'Etažiranje', offsetDays: 830 },
        { name: 'Uknjižba etažnog vlasništva', offsetDays: 870 }
      ]
    }
  ]
}

export const MILESTONE_TEMPLATES: MilestoneTemplate[] = [RESIDENTIAL_HR_TEMPLATE]
