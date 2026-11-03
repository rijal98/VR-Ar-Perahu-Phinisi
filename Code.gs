/**
 * Proxy GenAI "Daeng Pinisi" untuk Lopi Transformasi.
 * Kunci API Gemini disimpan di Script Properties (GEMINI_API_KEY), bukan di halaman web.
 * Deploy: Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.
 */
var MODEL = 'gemini-2.5-flash';

var PERSONA =
  'Kamu adalah Daeng Pinisi, tutor ramah untuk mahasiswa Grafika Komputer yang belajar transformasi 3D ' +
  '(translasi, rotasi, skala, komposisi matriks homogen 4x4) memakai perahu Pinisi Bugis-Makassar. ' +
  'Aturan: jawab bahasa Indonesia, maksimal 110 kata, boleh menyapa dengan "Iye". ' +
  'Gunakan metode Sokratik: beri petunjuk dan pertanyaan pemandu, JANGAN langsung memberi angka jawaban misi. ' +
  'Pegang fakta: matriks paling kanan dikenakan paling dulu pada titik; kolom ke-4 matriks memuat translasi; ' +
  'rotasi berpusat di titik asal dunia. Jangan mengarang fakta budaya; bila tidak yakin, katakan tidak yakin. ' +
  'Gunakan data konteks (state, matriks, target, status) yang diberikan untuk menyesuaikan petunjuk.';

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!key) return out_({ ok: false, error: 'GEMINI_API_KEY belum diatur' });

    var mode = req.mode, ctx = JSON.stringify(req.context || {}), msg = String(req.message || '').slice(0, 800);
    var system = PERSONA, contents = [], cfg = { temperature: 0.6, maxOutputTokens: 400 };

    if (mode === 'challenge') {
      system += ' Tugas khusus: buat SATU tantangan transformasi baru. Keluarkan HANYA JSON valid tanpa teks lain: ' +
        '{"cerita":"1-2 kalimat cerita pendek bernuansa pelayaran Bugis-Makassar","tx":angka -8..8,"tz":angka -8..8,"ry":angka -180..180,"s":angka 0.6..1.6}.';
      contents = [{ role: 'user', parts: [{ text: 'Konteks: ' + ctx }] }];
      cfg.responseMimeType = 'application/json'; cfg.temperature = 0.9;
    } else if (mode === 'reflect') {
      system += ' Tugas khusus: nilai penjelasan mahasiswa mengapa T*R dan R*T memberi hasil berbeda. ' +
        'Sebut apa yang sudah benar, apa yang kurang, lalu satu pertanyaan lanjutan. Jangan membocorkan jawaban lengkap.';
      contents = [{ role: 'user', parts: [{ text: 'Jawaban mahasiswa: ' + msg }] }];
    } else {
      (req.history || []).slice(-6).forEach(function (h) {
        contents.push({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: String(h.text).slice(0, 600) }] });
      });
      if (!contents.length || contents[contents.length - 1].role !== 'user')
        contents.push({ role: 'user', parts: [{ text: msg }] });
      contents[contents.length - 1].parts[0].text += '\n\n[Konteks saat ini: ' + ctx + ']';
    }

    var r = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent',
      { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'x-goog-api-key': key },
        payload: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: contents, generationConfig: cfg }) });
    var j = JSON.parse(r.getContentText());
    if (r.getResponseCode() !== 200) return out_({ ok: false, error: (j.error && j.error.message) || 'Gemini error' });
    var t = j.candidates && j.candidates[0] && j.candidates[0].content.parts.map(function (p) { return p.text; }).join('');
    return out_({ ok: !!t, text: t, error: t ? undefined : 'jawaban kosong' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
