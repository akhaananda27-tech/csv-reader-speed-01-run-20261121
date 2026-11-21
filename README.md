# Read broken CSV files faster

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/akhaananda27-tech/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/akhaananda27-tech/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A fast drop-in for [make.fun](https://make.fun)'s own csv-reader 1.0.0: it answers
exactly as csv-reader does on every case, but reads the text with `slice()` cuts
instead of one character at a time.

Built for the [$100 bounty on make.fun](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
— "Read broken CSV files faster, 21 November 2026". My referral: https://make.fun/r/jfeejy4f

## How it works

`solve.js` exports `run(input)`, which returns csv-reader's reading of
`{text, header}` as `{columns, rows, errors}`. It follows csv-reader's broken-row
policy exactly (BOM, stray CRs, unterminated quotes, quote junk, short/long rows),
but finds each field's end with a RegExp scan and cuts the field out whole with
`slice()`, so it never builds a field up one character at a time.

`main.ts` is the program the harness runs: it reads every case from
`/input/cases.json`, answers each one alone with `run`, and writes
`/output/answers.json`.

## Run it

```sh
node main.ts
```

It reads `cases.json` from `MAKEFUN_INPUT_DIR` (default `/input`) and writes
`answers.json` to `MAKEFUN_OUTPUT_DIR` (default `/output`).
