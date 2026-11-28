import type { TranslationKey } from '../services/i18n';

export type PhetSubject = 'Physics' | 'Chemistry' | 'Biology' | 'Math' | 'Earth';

export interface PhetBuiltinSim {
  /** PhET's own simulation name, so a built-in entry lines up with the live catalog. */
  name: string;
  category: PhetSubject;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}

const sim = (name: string, category: PhetSubject, key: string): PhetBuiltinSim => ({
  name,
  category,
  titleKey: `phet_sim_${key}_t` as TranslationKey,
  descKey: `phet_sim_${key}_d` as TranslationKey,
});

/** Shown when PhET cannot be reached, and the source of our translated descriptions. */
export const PHET_BUILTIN_SIMS: readonly PhetBuiltinSim[] = [
  sim('projectile-motion', 'Physics', 'projectile'),
  sim('circuit-construction-kit-dc', 'Physics', 'circuit'),
  sim('forces-and-motion-basics', 'Physics', 'forces'),
  sim('balancing-chemical-equations', 'Chemistry', 'balancing'),
  sim('acid-base-solutions', 'Chemistry', 'acid_base'),
  sim('molecule-shapes', 'Chemistry', 'molecule_shapes'),
  sim('natural-selection', 'Biology', 'natural_selection'),
  sim('gene-expression-essentials', 'Biology', 'gene_expression'),
  sim('wave-on-a-string', 'Physics', 'wave_string'),
  sim('ohms-law', 'Physics', 'ohms_law'),
  sim('balloons-and-static-electricity', 'Physics', 'balloons'),
  sim('bending-light', 'Physics', 'bending_light'),
  sim('masses-and-springs', 'Physics', 'masses_springs'),
  sim('pendulum-lab', 'Physics', 'pendulum'),
  sim('energy-skate-park-basics', 'Physics', 'skate_basics'),
  sim('color-vision', 'Physics', 'color_vision'),
  sim('ph-scale', 'Chemistry', 'ph_scale'),
  sim('molarity', 'Chemistry', 'molarity'),
  sim('build-an-atom', 'Chemistry', 'build_atom'),
  sim('gas-properties', 'Chemistry', 'gas_properties'),
  sim('concentration', 'Chemistry', 'concentration'),
  sim('beers-law-lab', 'Chemistry', 'beers_law'),
  sim('states-of-matter-basics', 'Chemistry', 'states_matter'),
  sim('neuron', 'Biology', 'neuron'),
  sim('membrane-channels', 'Biology', 'membrane'),
  sim('area-builder', 'Math', 'area_builder'),
  sim('fraction-matcher', 'Math', 'fraction_matcher'),
  sim('graphing-lines', 'Math', 'graphing_lines'),
  sim('least-squares-regression', 'Math', 'least_squares'),
];

export const phetBuiltinUrl = (name: string): string =>
  `https://phet.colorado.edu/sims/html/${name}/latest/${name}_en.html`;
