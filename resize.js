const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_DIR = path.resolve(__dirname, 'source');
const OUTPUT_DIR = path.resolve(__dirname, 'output');

const args = process.argv.slice(2);

const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return fallback;
  const val = args[idx + 1];
  return val === undefined ? fallback : val;
};

const width = parseInt(getArg('--width', '1200'), 10);
const height = parseInt(getArg('--height', '0'), 10);
const quality = parseInt(getArg('--quality', '80'), 10);

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`Folder sumber tidak ditemukan: ${SOURCE_DIR}`);
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const isImage = (filename) => /\.(jpe?g|png|webp)$/i.test(filename);

const resizeImage = async (file) => {
  const inputPath = path.join(SOURCE_DIR, file);
  const outputPath = path.join(OUTPUT_DIR, file);
  const ext = path.extname(file).toLowerCase();

  const pipeline = sharp(inputPath).resize({
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
    fit: 'inside',
    withoutEnlargement: true
  });

  if (ext === '.png') {
    pipeline.png({ quality: Math.max(1, Math.min(quality, 100)), compressionLevel: 9 });
  } else if (ext === '.webp') {
    pipeline.webp({ quality: Math.max(1, Math.min(quality, 100)) });
  } else {
    pipeline.jpeg({ quality: Math.max(1, Math.min(quality, 100)), mozjpeg: true });
  }

  await pipeline.toFile(outputPath);
  return outputPath;
};

const run = async () => {
  const files = fs.readdirSync(SOURCE_DIR).filter((file) => {
    const fullPath = path.join(SOURCE_DIR, file);
    return fs.statSync(fullPath).isFile() && isImage(file);
  });

  if (!files.length) {
    console.log('Tidak ada file gambar di folder source.');
    return;
  }

  console.log(`Memproses ${files.length} gambar...`);
  let success = 0;

  for (const file of files) {
    try {
      await resizeImage(file);
      success += 1;
      console.log(`✓ ${file}`);
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`);
    }
  }

  console.log(`Selesai. Berhasil: ${success}/${files.length}. Hasil ada di folder ${OUTPUT_DIR}.`);
};

run();
