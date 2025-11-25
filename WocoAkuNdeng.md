How to used :

npm install

In-place resize (tanpa output folder terpisah):
npm run resize -- --in-place --width 1200 --quality 80 --min-size-kb 500

Jika ingin tetap ke folder lain (default output/):
npm run resize -- --output output --width 1200 --quality 80 --min-size-kb 500

Jika butuh resize semua tanpa batas ukuran: set --min-size-kb 0.
