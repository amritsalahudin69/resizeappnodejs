const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const args = process.argv.slice(2);

const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return fallback;
  const val = args[idx + 1];
  return val === undefined ? fallback : val;
};

const SOURCE_DIR = path.resolve(__dirname, 'source');
const argOutput = getArg('--output', 'output');
const IN_PLACE = args.includes('--in-place');
const OUTPUT_DIR = IN_PLACE ? SOURCE_DIR : path.resolve(__dirname, argOutput);

const width = parseInt(getArg('--width', '1200'), 10);
const height = parseInt(getArg('--height', '0'), 10);
const quality = parseInt(getArg('--quality', '80'), 10);
const minSizeKb = parseInt(getArg('--min-size-kb', '500'), 10); // hanya proses file >= ukuran ini

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`Folder sumber tidak ditemukan: ${SOURCE_DIR}`);
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const isImage = (filename) => /\.(jpe?g|png|webp)$/i.test(filename);

const listImages = (dir, base = SOURCE_DIR) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    // Jika output folder berada di dalam source, hindari memprosesnya ketika bukan in-place
    if (!IN_PLACE && path.resolve(absPath).startsWith(path.resolve(OUTPUT_DIR))) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...listImages(absPath, base));
    } else if (entry.isFile() && isImage(entry.name)) {
      const relative = path.relative(base, absPath);
      files.push(relative);
    }
  }
  return files;
};

const resizeImage = async (relativePath) => {
  const inputPath = path.join(SOURCE_DIR, relativePath);
  const outputPath = path.join(OUTPUT_DIR, relativePath);
  const ext = path.extname(relativePath).toLowerCase();
  const stat = fs.statSync(inputPath);
  const minBytes = Number.isFinite(minSizeKb) && minSizeKb > 0 ? minSizeKb * 1024 : 0;

  // Skip jika file kecil dan dimensi tidak melebihi target (hindari re-resize)
  const metadata = await sharp(inputPath).metadata();
  const needBySize = minBytes > 0 ? stat.size >= minBytes : true;
  const needByDim =
    (Number.isFinite(width) && width > 0 && metadata.width && metadata.width > width) ||
    (Number.isFinite(height) && height > 0 && metadata.height && metadata.height > height);

  if (!needBySize && !needByDim) {
    return { status: 'skipped', reason: 'kecil' };
  }

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

  if (IN_PLACE && outputPath === inputPath) {
    const tempPath = `${outputPath}.tmp-resize`;
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    await pipeline.toFile(tempPath);
    fs.renameSync(tempPath, outputPath);
  } else {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await pipeline.toFile(outputPath);
  }

  return { status: 'done', outputPath };
};

const run = async () => {
  const files = listImages(SOURCE_DIR);

  if (!files.length) {
    console.log('Tidak ada file gambar di folder source (termasuk subfolder).');
    return;
  }

  console.log(`Memproses ${files.length} gambar...`);
  let success = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const result = await resizeImage(file);
      if (result.status === 'skipped') {
        skipped += 1;
        console.log(`- ${file} (skip: ${result.reason})`);
      } else {
        success += 1;
        console.log(`OK ${file}`);
      }
    } catch (err) {
      console.error(`ERR ${file}: ${err.message}`);
    }
  }

  console.log(
    `Selesai. Berhasil: ${success}, dilewati: ${skipped}, total: ${files.length}. Hasil di ${OUTPUT_DIR}.`
  );
};

run();


// run : npm run resize -- --in-place --width 1200 --quality 80 --min-size-kb 500
