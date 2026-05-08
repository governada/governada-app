import { config } from 'dotenv';
config({ path: '.env.local' });

import { runCalibrationSelfTest } from '@/lib/seneca/eval/calibration';

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not configured; cannot run the Sonnet calibration judge.');
    process.exit(1);
  }

  const results = await runCalibrationSelfTest();
  const failures = results.filter(({ result }) => result.score < 3);
  const passed = results.length - failures.length;

  console.log(`Seneca calibration self-test: ${passed}/${results.length}`);

  for (const entry of results) {
    console.log(
      `${entry.result.score === 3 ? 'PASS' : 'FAIL'} ${entry.source} / ${entry.title}: ${entry.result.score}/3`,
    );
    if (entry.result.score < 3) {
      console.log(`  ${entry.result.reasoning}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      `Calibration self-test failed: ${failures.length} example(s) scored below 3/3. Iterate on the judge prompt before launch.`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
