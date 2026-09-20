---
name: benchmark
description: AI classifier benchmark runner — executes few-shot holdout tests and reports honest accuracy metrics.
---

# /benchmark — AI Classifier Benchmark Runner

Execute and report benchmark evaluations:
1. **Run Benchmark Script**: Execute `npx tsx scripts/run_ai_benchmark.ts` to evaluate zero-shot vs few-shot classification.
2. **Evaluate Holdout**: Check top-1 and top-3 accuracy on holdout test sets without data leakage.
3. **Honest Metrics**: Never fabricate benchmark scores; report exact confusion matrix values and sample sizes.
4. **Log Results**: Save performance metrics to `output/benchmark_results.json` for inclusion in competition dossiers.
