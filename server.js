import express from 'express';
import archiver from 'archiver';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp } from 'fs/promises';
import { createWriteStream } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ytdl from 'ytdl-core';
import ytpl from 'ytpl';

ffmpeg.setFfmpegPath(ffmpegStatic);
const app = express();
app.use(express.json());

app.post('/download', async (req, res) => {
  try {
    let { playlistUrl } = req.body;
    if (!playlistUrl) return res.status(400).send('Envie { playlistUrl: "URL_da_playlist" }');

    // Remove parâmetros extras do link
    const cleanUrl = playlistUrl.split('&')[0];
    const playlist = await ytpl(cleanUrl, { pages: Infinity });
    const videos = playlist.items.filter(v => !v.isPrivate && !v.isDeleted);

    const dir = await mkdtemp(join(tmpdir(), 'wav-'));
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${playlist.title}.zip"`);

    const archive = archiver('zip');
    archive.pipe(res);

    let index = 1;
    for (const video of videos) {
      try {
        console.log(`Baixando: ${video.title}`);
        const tmpFile = join(dir, `input${index}.mp3`);
        await new Promise((resolve, reject) => {
          ytdl(video.url, { filter: 'audioonly' })
            .pipe(createWriteStream(tmpFile))
            .on('finish', resolve)
            .on('error', reject);
        });

        const outFile = join(dir, `track${index}.wav`);
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

        const cleanName = video.title.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 100);
        archive.file(outFile, { name: `${String(index).padStart(3,'0')}-${cleanName}.wav` });
      } catch(e) {
        console.log(`Erro no vídeo ${video.title}, pulando...`);
      }
      index++;
    }

    await archive.finalize();
  } catch(e) {
    console.error(e);
    res.status(500).send('Erro ao processar playlist');
  }
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));
