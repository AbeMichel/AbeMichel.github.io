import { FragileModifier } from './fragile.js';
import { DecayingModifier } from './decaying.js';
import { SymbolsModifier } from './symbols.js';
import { NoCandidatesModifier } from './noCandidates.js';
import { CandidateOnlyModifier } from './candidateOnly.js';
import { BlackoutModifier } from './blackout.js';
import { TimeOutModifier } from './timeOut.js';
import { OrderedModifier } from './ordered.js';
import { SmallNotepadModifier } from './smallNotepad.js';
import { LivingModifier } from './living.js';

export const MODIFIERS = [
  FragileModifier,
  DecayingModifier,
  SymbolsModifier,
  NoCandidatesModifier,
  CandidateOnlyModifier,
  BlackoutModifier,
  TimeOutModifier,
  OrderedModifier,
  SmallNotepadModifier,
  LivingModifier
];

export const getModifier = (id) => MODIFIERS.find(m => m.id === id);

export const getActiveModifiers = (activeIds) => 
  MODIFIERS.filter(m => activeIds.includes(m.id));
