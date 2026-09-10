import type { LineItem, ConstructionSection } from './utils/ticFormatters'

/**
 * Default rows for the INVESTICIJA tab. Croatian domain terms — never translated.
 * These are only a starting point: every row is editable and removable per project.
 */
export const defaultLineItems: LineItem[] = [
  { name: 'Priprema projekta', vlastita: 0, kreditna: 0 },
  { name: 'Vrijednost zemljišta', vlastita: 0, kreditna: 0 },
  { name: 'Porez na promet nekretnina', vlastita: 0, kreditna: 0 },
  { name: 'Projektna dokumentacija, geodetske usluge', vlastita: 0, kreditna: 0 },
  { name: 'Komunalni i vodni doprinos', vlastita: 0, kreditna: 0 },
  { name: 'Priključci', vlastita: 0, kreditna: 0 },
  { name: 'Unutarnje uređenje', vlastita: 0, kreditna: 0 },
  { name: 'Građenje', vlastita: 0, kreditna: 0 },
  { name: 'Opremanje (namještaj, bijela tehnika)', vlastita: 0, kreditna: 0 },
  { name: 'Stručni nadzor', vlastita: 0, kreditna: 0 },
  { name: 'Konzalting', vlastita: 0, kreditna: 0 },
  { name: 'Posredovanje, marketing, osiguranje', vlastita: 0, kreditna: 0 },
  { name: 'Financijski nadzor', vlastita: 0, kreditna: 0 },
  { name: 'Financiranje', vlastita: 0, kreditna: 0 },
  { name: 'Uknjižba, etažiranje, uporabna dozvola', vlastita: 0, kreditna: 0 },
  { name: 'Nepredviđeni troškovi', vlastita: 0, kreditna: 0 },
]

/**
 * Default sections for the GRAĐENJE tab, matching the standard
 * "Struktura troškova građenja" sheet. Also editable per project.
 */
export const defaultConstructionSections: ConstructionSection[] = [
  {
    code: 'A)',
    name: 'GRAĐEVINSKI RADOVI',
    items: [
      { numeral: 'I.', name: 'Pripremni radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'II.', name: 'Razni građevinski radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'III.', name: 'Zemljani radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'IV.', name: 'Betonski i arm. - bet. radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'V.', name: 'Armirački radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'VI.', name: 'Zidarski radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'VII.', name: 'Fasaderski radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'VIII.', name: 'Skelarski radovi', vlastita: 0, kreditna: 0 },
    ],
  },
  {
    code: 'B)',
    name: 'OBRTNIČKI RADOVI',
    items: [
      { numeral: 'I.', name: 'Asfalterski radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'II.', name: 'Izolaterski radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'III.', name: 'Gips kartonski radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'IV.', name: 'Limarski radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'V.', name: 'Kamenorezački radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'VI.', name: 'Podopolagački radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'VII.', name: 'Parketarski radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'VIII.', name: 'Soboslik. - ličilački radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'IX.', name: 'Razni obrtnički radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'X.', name: 'Oprema objekta (parketi, pločice, keramika)', vlastita: 0, kreditna: 0 },
      { numeral: 'XI.', name: 'Hortikultura', vlastita: 0, kreditna: 0 },
      { numeral: 'XII.', name: 'Stolarski radovi', vlastita: 0, kreditna: 0 },
      { numeral: 'XIII.', name: 'Blind vrata + ugradnja', vlastita: 0, kreditna: 0 },
      { numeral: 'XIV.', name: 'Vanjska stolarija', vlastita: 0, kreditna: 0 },
      { numeral: 'XV.', name: 'Bravarija', vlastita: 0, kreditna: 0 },
    ],
  },
  {
    code: 'C)',
    name: 'INSTALATERSKI RADOVI',
    items: [
      { numeral: 'I.', name: 'Elektroinstalacije', vlastita: 0, kreditna: 0 },
      { numeral: 'II.', name: 'Hidroinstalacije', vlastita: 0, kreditna: 0 },
      { numeral: 'III.', name: 'Sprinkler', vlastita: 0, kreditna: 0 },
      { numeral: 'IV.', name: 'Termotehničke (strojarske) instalacije', vlastita: 0, kreditna: 0 },
      { numeral: 'V.', name: 'Dizala', vlastita: 0, kreditna: 0 },
    ],
  },
]
