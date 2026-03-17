import { runTests as runActionTests } from './core/actions.test.js';
import { runTests as runStoreTests } from './core/store.test.js';
import { runTests as runHistoryTests } from './core/history.test.js';
import { runTests as runTechniquesTests } from './config/techniques.test.js';
import { runTests as runPRNGTests } from './logic/prng.test.js';
import { runTests as runSolverTests } from './logic/solver.test.js';
import { runTests as runGeneratorTests } from './logic/generator.test.js';
import { runTests as runModifierTests } from './modifiers/modifiers.test.js';
import { runTests as runGeometryTests } from './utils/boardGeometry.test.js';
import { runTests as runPieceGeometryTests } from './utils/pieceGeometry.test.js';
import { runTests as runHintsTests } from './services/hints.test.js';

export const runAllTests = () => {
  console.log('--- STARTING ALL TESTS ---');
  runActionTests();
  runStoreTests();
  runHistoryTests();
  runTechniquesTests();
  runPRNGTests();
  runSolverTests();
  runGeneratorTests();
  runModifierTests();
  runGeometryTests();
  runPieceGeometryTests();
  runHintsTests();
  console.log('--- ALL TESTS COMPLETE ---');
};
