import express from 'express';
import archiver from 'archiver';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp } from 'fs/promises';
import { createWriteStream } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { request } from 'undici';
import { pipeline } from 'stream/promises';

ffmpeg.setFfmpegPath(ffmpegStatic);
const app = express();
app.use(express.json());

app.post('/download', async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) return res.status(400).send('Envie { urls: ["http://..."] }');

  const dir = await mkdtemp(join(tmpdir(), 'wav-'));
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="playlist.zip"');

  const archive = archiver('zip');
  archive.pipe(res);

  let i = 1;
  for (const u of urls) {
    try {
      const tmpFile = join(dir, `input${i}.mp3`);
      const { body } = await request(u);
      await pipeline(body, createWriteStream(tmpFile));

      const outFile = join(dir, `track${i}.wav`);
      await new Promise((resolve, reject) => {
        ffmpeg(tmpFile)
          .audioCodec('pcm_s16le')
          .audioChannels(2)
          .audioFrequency(44100)
          .format('wav')
          .save(outFile)
          .on('end', resolve)
          .on('error', reject);
      });

      archive.file(outFile, { name: `track${i}.wav` });
    } catch (e) {
      console.error('Erro em', u, e);
    }
    i++;
  }

  await archive.finalize();
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));
