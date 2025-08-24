from flask import Flask, render_template, request, send_file
from pytube import YouTube, Playlist
import os
import zipfile
import subprocess
import requests

app = Flask(__name__)

def convert_to_wav(file_path):
    wav_file = os.path.splitext(file_path)[0] + ".wav"
    subprocess.run(["ffmpeg", "-i", file_path, "-vn", "-acodec", "pcm_s16le", wav_file])
    os.remove(file_path)
    return wav_file

def get_bpm(file_path):
    try:
        # Exemplo: consulta API fictícia para BPM
        response = requests.post("https://api.musicbpm.com/analyze", files={"file": open(file_path, "rb")})
        data = response.json()
        return data.get("bpm", "N/A")
    except:
        return "N/A"

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        url = request.form.get("url")
        try:
            downloaded_files = []

            if "playlist" in url:
                pl = Playlist(url)
                for video in pl.videos:
                    stream = video.streams.filter(only_audio=True).first()
                    file_path = stream.download()
                    wav_file = convert_to_wav(file_path)
                    bpm = get_bpm(wav_file)
                    print(f"{video.title} - BPM: {bpm}")
                    downloaded_files.append(wav_file)

                zip_filename = "playlist_download.zip"
                with zipfile.ZipFile(zip_filename, 'w') as zipf:
                    for file in downloaded_files:
                        zipf.write(file)
                        os.remove(file)

                return send_file(zip_filename, as_attachment=True)

            else:
                yt = YouTube(url)
                stream = yt.streams.filter(only_audio=True).first()
                file_path = stream.download()
                wav_file = convert_to_wav(file_path)
                bpm = get_bpm(wav_file)
                print(f"{yt.title} - BPM: {bpm}")
                return send_file(wav_file, as_attachment=True)

        except Exception as e:
            return f"Erro: {e}"
    return render_template("index.html")
