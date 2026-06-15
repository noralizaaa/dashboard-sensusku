const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
const { Server } = require('socket.io');

const app = express();
const port = 3000;

// ===============================
// Setup HTTP Server + Socket.IO
// ===============================
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

// ===============================
// Koneksi MySQL XAMPP / Server MySQL
// ===============================
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'desa_db'
});

db.connect(function (err) {
    if (err) {
        console.error('--------------------------------------------------');
        console.error('GAGAL KONEKSI MYSQL');
        console.error('Pastikan MySQL sudah START.');
        console.error('Pastikan database "desa_db" sudah dibuat.');
        console.error('Pastikan tabel "submissions" sudah dibuat.');
        console.error('--------------------------------------------------');
        console.error(err);
        return;
    }

    console.log('Koneksi MySQL berhasil.');
});

// ===============================
// Middleware
// ===============================
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// ===============================
// Setup Folder Upload
// ===============================
const uploadDir = 'uploads';

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// ===============================
// Setup Folder Dashboard Web
// ===============================
const publicDir = 'public';

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// Agar gambar bisa diakses lewat browser
app.use('/uploads', express.static(uploadDir));

// Agar dashboard web bisa dibuka lewat http://localhost:3000
app.use(express.static(publicDir));

// Log setiap request
app.use(function (req, res, next) {
    console.log(`[${new Date().toLocaleString()}] ${req.method} request ke ${req.url}`);
    next();
});

// ===============================
// Konfigurasi Multer untuk Upload Gambar
// ===============================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const fileName = Date.now() + path.extname(file.originalname);
        cb(null, fileName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

// ===============================
// Helper Periode Bulan
// Format: YYYY-MM
// ===============================
function getCurrentPeriod() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
}

function getPreviousPeriod(currentPeriod) {
    const parts = currentPeriod.split('-');

    let year = Number(parts[0]);
    let month = Number(parts[1]);

    if (!year || !month) {
        return getCurrentPeriod();
    }

    if (month === 1) {
        month = 12;
        year = year - 1;
    } else {
        month = month - 1;
    }

    return `${year}-${String(month).padStart(2, '0')}`;
}

// ===============================
// Helper Parse JSON dari MySQL
// ===============================
function parseContent(content) {
    if (!content) {
        return {};
    }

    if (typeof content === 'string') {
        try {
            return JSON.parse(content);
        } catch (err) {
            console.error('Gagal parse content JSON:', err.message);
            return {};
        }
    }

    return content;
}

// ===============================
// Helper Normalisasi Submission Row
// ===============================
function normalizeSubmissionRow(row) {
    const data = parseContent(row.content);

    data.id = row.id;
    data.localId = data.localId || row.id;

    if (!data.formId) {
        data.formId = row.formId;
    }

    if (!data.userId) {
        data.userId = row.userId;
    }

    if (!data.villageId) {
        data.villageId = row.villageId;
    }

    if (!data.period) {
        data.period = row.period;
    }

    return data;
}

// ===============================
// Helper Ambil Jawaban dari answers[]
// ===============================
function getAnswer(answers, keyword) {
    let result = null;

    if (!Array.isArray(answers)) {
        return result;
    }

    answers.forEach(function (item) {
        const question = String(item.questionText || '').toLowerCase();

        if (question.includes(keyword.toLowerCase())) {
            result = item.answer;
        }
    });

    return result;
}

function getNumberAnswer(answers, keyword) {
    const value = getAnswer(answers, keyword);

    if (value === null || value === undefined || value === '') {
        return 0;
    }

    return Number(value) || 0;
}

// ===============================
// Helper Log Ringkas Submission
// Supaya terminal tidak berat
// ===============================
function logSubmissionSummary(title, data, id) {
    console.log(title);
    console.log('id:', id || data.id || '-');
    console.log('formId:', data.formId || '-');
    console.log('userId:', data.userId || '-');
    console.log('villageId:', data.villageId || '-');
    console.log('period:', data.period || '-');
    console.log('status:', data.status || '-');
    console.log('jumlah answers:', Array.isArray(data.answers) ? data.answers.length : 0);
    console.log('jumlah imageUrls:', Array.isArray(data.imageUrls) ? data.imageUrls.length : 0);
}

// ===============================
// Socket.IO Realtime
// ===============================
io.on('connection', function (socket) {
    console.log('Dashboard terhubung realtime:', socket.id);

    socket.on('disconnect', function () {
        console.log('Dashboard terputus:', socket.id);
    });
});

// ===============================
// Endpoint Cek Server
// ===============================
app.get('/api/health', function (req, res) {
    res.status(200).send({
        message: 'Server aktif',
        storage: 'MYSQL',
        realtime: 'Socket.IO aktif',
        port: port
    });
});

// ===============================
// Endpoint Upload Gambar
// ===============================
app.post('/api/upload', upload.single('image'), function (req, res) {
    console.time('WAKTU_UPLOAD_GAMBAR');

    if (!req.file) {
        console.timeEnd('WAKTU_UPLOAD_GAMBAR');

        return res.status(400).send({
            message: 'Gagal upload gambar'
        });
    }

    const imageUrl = `http://${req.hostname}:${port}/uploads/${req.file.filename}`;

    console.log('=== GAMBAR DITERIMA ===');
    console.log('Nama file:', req.file.filename);
    console.log('Ukuran file:', req.file.size, 'bytes');
    console.log('URL:', imageUrl);

    console.timeEnd('WAKTU_UPLOAD_GAMBAR');

    res.status(200).send({
        message: 'Gambar berhasil diupload',
        imageUrl: imageUrl,
        filename: req.file.filename,
        size: req.file.size
    });
});

// ===============================
// Endpoint Ambil Semua Data Submission
// Bisa filter formId, userId, villageId, period
// Bisa auto duplicate dengan autoDuplicate=true
// ===============================
app.get('/api/submissions', function (req, res) {
    const formId = req.query.formId;
    const userId = req.query.userId;
    const villageId = req.query.villageId;
    const period = req.query.period;
    const autoDuplicate = req.query.autoDuplicate;

    const currentPeriod = period || getCurrentPeriod();
    const previousPeriod = getPreviousPeriod(currentPeriod);

    console.log('=== MENGAMBIL DATA SUBMISSION ===');
    console.log('formId:', formId || 'ALL');
    console.log('userId:', userId || 'ALL');
    console.log('villageId:', villageId || 'ALL / tidak dikirim');
    console.log('period:', period || `tidak dikirim, pakai otomatis: ${currentPeriod}`);
    console.log('autoDuplicate:', autoDuplicate || 'false');

    let sql = 'SELECT id, formId, userId, villageId, period, content FROM submissions WHERE 1=1';
    const params = [];

    if (formId) {
        sql += ' AND formId = ?';
        params.push(formId);
    }

    if (userId) {
        sql += ' AND userId = ?';
        params.push(userId);
    }

    if (villageId) {
        sql += ' AND villageId = ?';
        params.push(villageId);
    }

    sql += ' AND period = ?';
    params.push(currentPeriod);

    db.query(sql, params, function (err, results) {
        if (err) {
            console.error('ERROR GET MYSQL:', err);

            return res.status(500).send({
                message: 'Gagal mengambil data dari MySQL',
                error: err.message
            });
        }

        let userSubmissions = results.map(function (row) {
            return normalizeSubmissionRow(row);
        });

        if (autoDuplicate === 'true' && userSubmissions.length === 0) {
            console.log(`[AutoDuplicate] Data periode ${currentPeriod} belum ada.`);
            console.log(`[AutoDuplicate] Mengecek data ${previousPeriod} untuk dicopy ke ${currentPeriod}.`);

            let previousSql = 'SELECT id, formId, userId, villageId, period, content FROM submissions WHERE 1=1';
            const previousParams = [];

            if (formId) {
                previousSql += ' AND formId = ?';
                previousParams.push(formId);
            }

            if (userId) {
                previousSql += ' AND userId = ?';
                previousParams.push(userId);
            }

            if (villageId) {
                previousSql += ' AND villageId = ?';
                previousParams.push(villageId);
            }

            previousSql += ' AND period = ?';
            previousParams.push(previousPeriod);

            db.query(previousSql, previousParams, function (previousErr, previousResults) {
                if (previousErr) {
                    console.error('ERROR GET PREVIOUS MYSQL:', previousErr);

                    return res.status(500).send({
                        message: 'Gagal mengambil data periode sebelumnya dari MySQL',
                        error: previousErr.message
                    });
                }

                const previousData = previousResults.map(function (row) {
                    return normalizeSubmissionRow(row);
                });

                if (previousData.length === 0) {
                    console.log(`[AutoDuplicate] Tidak ada data bulan sebelumnya (${previousPeriod}).`);
                    return res.status(200).json([]);
                }

                const duplicatedData = previousData.map(function (oldData, index) {
                    const duplicateId = `DUP_SQL_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;

                    return {
                        ...oldData,
                        id: duplicateId,
                        localId: duplicateId,
                        period: currentPeriod,
                        status: 'submitted',
                        isAutoGenerated: true,
                        submittedAt: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        duplicatedFrom: oldData.id || oldData.localId || null,
                        duplicatedFromPeriod: previousPeriod
                    };
                });

                if (duplicatedData.length === 0) {
                    return res.status(200).json([]);
                }

                let insertedCount = 0;
                let hasInsertError = false;

                duplicatedData.forEach(function (item) {
                    db.query(
                        'INSERT INTO submissions (id, formId, userId, villageId, period, content) VALUES (?, ?, ?, ?, ?, ?)',
                        [
                            item.id,
                            item.formId || null,
                            item.userId || null,
                            item.villageId || null,
                            item.period || null,
                            JSON.stringify(item)
                        ],
                        function (insertErr) {
                            if (insertErr) {
                                hasInsertError = true;
                                console.error('ERROR AUTO DUPLICATE:', insertErr.message);
                            }

                            insertedCount++;

                            if (insertedCount === duplicatedData.length) {
                                if (hasInsertError) {
                                    return res.status(500).send({
                                        message: 'Sebagian data gagal diduplikasi otomatis'
                                    });
                                }

                                console.log(`[AutoDuplicate] Berhasil duplikat ${duplicatedData.length} data.`);

                                io.emit('dashboard_updated', {
                                    action: 'auto_duplicate',
                                    message: 'Data berhasil diduplikasi otomatis',
                                    period: currentPeriod,
                                    count: duplicatedData.length
                                });

                                return res.status(200).json(duplicatedData);
                            }
                        }
                    );
                });
            });

            return;
        }

        console.log(`Data ditemukan untuk periode ${currentPeriod}: ${userSubmissions.length}`);

        res.status(200).json(userSubmissions);
    });
});

// ===============================
// Endpoint Ambil Detail Satu Submission
// ===============================
app.get('/api/submissions/:id', function (req, res) {
    const id = req.params.id;

    console.log(`=== MENGAMBIL DETAIL DATA ID: ${id} ===`);

    db.query(
        'SELECT id, formId, userId, villageId, period, content FROM submissions WHERE id = ?',
        [id],
        function (err, results) {
            if (err) {
                console.error('ERROR GET DETAIL MYSQL:', err);

                return res.status(500).send({
                    message: 'Gagal mengambil detail dari MySQL',
                    error: err.message
                });
            }

            if (results.length === 0) {
                return res.status(404).send({
                    message: 'Data tidak ditemukan'
                });
            }

            const row = results[0];
            const content = normalizeSubmissionRow(row);

            res.status(200).json(content);
        }
    );
});

// ===============================
// Endpoint Simpan Data Baru / Update Draft
// PENTING:
// Menggunakan ON DUPLICATE KEY UPDATE
// Jadi kalau id sudah ada, data akan diupdate.
// Cocok untuk draft yang disimpan berkali-kali.
// ===============================
app.post('/api/submissions', function (req, res) {
    console.time('WAKTU_SIMPAN_MYSQL');

    const localId = req.body.id || req.body.localId || 'LOCAL_' + Date.now();

    const submissionData = {
        id: localId,
        localId: localId,
        receivedAt: req.body.receivedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...req.body
    };

    if (!submissionData.period) {
        submissionData.period = getCurrentPeriod();
    }

    if (!submissionData.status) {
        submissionData.status = 'submitted';
    }

    logSubmissionSummary('=== DATA SUBMISSION DITERIMA ===', submissionData, localId);

    const sql = `
        INSERT INTO submissions 
        (id, formId, userId, villageId, period, content) 
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            formId = VALUES(formId),
            userId = VALUES(userId),
            villageId = VALUES(villageId),
            period = VALUES(period),
            content = VALUES(content),
            updatedAt = CURRENT_TIMESTAMP
    `;

    const values = [
        localId,
        submissionData.formId || null,
        submissionData.userId || null,
        submissionData.villageId || null,
        submissionData.period || null,
        JSON.stringify(submissionData)
    ];

    db.query(sql, values, function (err) {
        console.timeEnd('WAKTU_SIMPAN_MYSQL');

        if (err) {
            console.error('=== ERROR SIMPAN MYSQL ===');
            console.error('Code:', err.code);
            console.error('Message:', err.message);

            return res.status(500).send({
                message: 'Gagal menyimpan data ke MySQL',
                code: err.code,
                error: err.message
            });
        }

        console.log('=== DATA BERHASIL DISIMPAN / DIUPDATE KE MYSQL ===');
        console.log('ID:', localId);
        console.log('villageId:', submissionData.villageId || 'tidak dikirim');
        console.log('period:', submissionData.period);
        console.log('status:', submissionData.status);

        io.emit('dashboard_updated', {
            action: 'upserted',
            message: 'Data berhasil disimpan atau diperbarui',
            id: localId,
            period: submissionData.period,
            villageId: submissionData.villageId || null,
            status: submissionData.status || null
        });

        res.status(201).send({
            message: 'Data berhasil disimpan atau diupdate ke MySQL!',
            id: localId,
            localId: localId,
            period: submissionData.period,
            status: submissionData.status
        });
    });
});

// ===============================
// Endpoint Update Data
// ===============================
app.put('/api/submissions/:id', function (req, res) {
    const updateId = req.params.id;

    logSubmissionSummary(`=== UPDATE DATA ID: ${updateId} ===`, req.body, updateId);

    db.query(
        'SELECT id, formId, userId, villageId, period, content FROM submissions WHERE id = ?',
        [updateId],
        function (err, results) {
            if (err) {
                console.error('ERROR CARI DATA MYSQL:', err);

                return res.status(500).send({
                    message: 'Gagal mencari data MySQL',
                    error: err.message
                });
            }

            if (results.length === 0) {
                return res.status(404).send({
                    message: 'Data tidak ditemukan'
                });
            }

            const row = results[0];
            const oldData = parseContent(row.content);

            const updatedData = {
                ...oldData,
                ...req.body,
                id: updateId,
                localId: updateId,
                updatedAt: new Date().toISOString()
            };

            if (!updatedData.formId) {
                updatedData.formId = row.formId;
            }

            if (!updatedData.userId) {
                updatedData.userId = row.userId;
            }

            if (!updatedData.villageId) {
                updatedData.villageId = row.villageId;
            }

            if (!updatedData.period) {
                updatedData.period = row.period || getCurrentPeriod();
            }

            db.query(
                'UPDATE submissions SET formId = ?, userId = ?, villageId = ?, period = ?, content = ? WHERE id = ?',
                [
                    updatedData.formId || null,
                    updatedData.userId || null,
                    updatedData.villageId || null,
                    updatedData.period || null,
                    JSON.stringify(updatedData),
                    updateId
                ],
                function (updateErr) {
                    if (updateErr) {
                        console.error('ERROR UPDATE MYSQL:', updateErr);

                        return res.status(500).send({
                            message: 'Gagal update data MySQL',
                            error: updateErr.message
                        });
                    }

                    console.log('=== DATA BERHASIL DIUPDATE DI MYSQL ===');
                    console.log('ID:', updateId);
                    console.log('period:', updatedData.period);
                    console.log('status:', updatedData.status || '-');

                    io.emit('dashboard_updated', {
                        action: 'updated',
                        message: 'Data berhasil diperbarui',
                        id: updateId,
                        period: updatedData.period,
                        villageId: updatedData.villageId || null,
                        status: updatedData.status || null
                    });

                    res.status(200).send({
                        message: 'Data berhasil diupdate di MySQL!',
                        id: updateId,
                        localId: updateId,
                        period: updatedData.period,
                        status: updatedData.status || null
                    });
                }
            );
        }
    );
});

// ===============================
// Endpoint Hapus Data
// ===============================
app.delete('/api/submissions/:id', function (req, res) {
    const id = req.params.id;

    console.log(`=== MENGHAPUS DATA ID: ${id} ===`);

    db.query(
        'DELETE FROM submissions WHERE id = ?',
        [id],
        function (err, result) {
            if (err) {
                console.error('ERROR DELETE MYSQL:', err);

                return res.status(500).send({
                    message: 'Gagal hapus data dari MySQL',
                    error: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).send({
                    message: 'Data tidak ditemukan'
                });
            }

            io.emit('dashboard_updated', {
                action: 'deleted',
                message: 'Data berhasil dihapus',
                id: id
            });

            res.status(200).send({
                message: 'Data berhasil dihapus dari MySQL!',
                id: id
            });
        }
    );
});

// ===============================
// Endpoint Rekap Dashboard
// Opsional, bisa dipakai dashboard agar tidak menghitung manual di frontend
// ===============================
app.get('/api/dashboard/summary', function (req, res) {
    const formId = req.query.formId;
    const userId = req.query.userId;
    const villageId = req.query.villageId;
    const period = req.query.period || getCurrentPeriod();

    let sql = 'SELECT id, formId, userId, villageId, period, content FROM submissions WHERE 1=1';
    const params = [];

    if (formId) {
        sql += ' AND formId = ?';
        params.push(formId);
    }

    if (userId) {
        sql += ' AND userId = ?';
        params.push(userId);
    }

    if (villageId) {
        sql += ' AND villageId = ?';
        params.push(villageId);
    }

    sql += ' AND period = ?';
    params.push(period);

    db.query(sql, params, function (err, results) {
        if (err) {
            console.error('ERROR REKAP DASHBOARD:', err);

            return res.status(500).send({
                message: 'Gagal mengambil rekap dashboard',
                error: err.message
            });
        }

        let totalKK = results.length;
        let totalPenduduk = 0;
        let totalBalita = 0;
        let totalWus = 0;
        let totalPus = 0;
        let totalIbuHamil = 0;
        let totalDisabilitas = 0;
        let totalSakitKronis = 0;

        results.forEach(function (row) {
            const item = normalizeSubmissionRow(row);
            const answers = item.answers || [];

            totalPenduduk += getNumberAnswer(answers, 'Jumlah Anggota Keluarga');
            totalBalita += getNumberAnswer(answers, 'Jumlah balita');
            totalWus += getNumberAnswer(answers, 'Wanita Usia Subur');
            totalPus += getNumberAnswer(answers, 'Pria Usia Subur');
            totalIbuHamil += getNumberAnswer(answers, 'Ibu Hamil');
            totalDisabilitas += getNumberAnswer(answers, 'Disabilitas');
            totalSakitKronis += getNumberAnswer(answers, 'Sakit Kronis');

            if (item.computedSummary && item.computedSummary.anggota_keluarga) {
                const summary = item.computedSummary.anggota_keluarga;

                totalPus += Number(summary.pus || 0);
                totalWus += Number(summary.wus || 0);
                totalIbuHamil += Number(summary.hamil || 0);
                totalDisabilitas += Number(summary.disabilitas || 0);
                totalSakitKronis += Number(summary.sakit_kronis || 0);
            }
        });

        res.status(200).send({
            period: period,
            totalKK: totalKK,
            totalPenduduk: totalPenduduk,
            totalBalita: totalBalita,
            totalWus: totalWus,
            totalPus: totalPus,
            totalIbuHamil: totalIbuHamil,
            totalDisabilitas: totalDisabilitas,
            totalSakitKronis: totalSakitKronis
        });
    });
});

// ===============================
// Error Handler Upload Multer
// ===============================
app.use(function (err, req, res, next) {
    if (err instanceof multer.MulterError) {
        console.error('ERROR MULTER:', err.message);

        return res.status(400).send({
            message: 'Gagal upload file',
            error: err.message
        });
    }

    if (err) {
        console.error('ERROR SERVER:', err.message);

        return res.status(500).send({
            message: 'Terjadi error pada server',
            error: err.message
        });
    }

    next();
});

// ===============================
// Menjalankan Server
// ===============================
server.listen(port, '0.0.0.0', function () {
    console.log('--------------------------------------------------');
    console.log('SERVER LOKAL BERJALAN');
    console.log(`Port: ${port}`);
    console.log('Mode penyimpanan: MYSQL');
    console.log('Realtime: Socket.IO aktif');
    console.log(`Akses laptop: http://localhost:${port}`);
    console.log(`Akses dari HP: http://IP-LAPTOP:${port}`);
    console.log(`Dashboard web: http://localhost:${port}`);
    console.log('--------------------------------------------------');
});