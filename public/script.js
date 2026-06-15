const socket = io();

let allSubmissions = [];
let ageChart = null;
let genderChart = null;
let map = null;
let markersLayer = null;
let isShowAllRows = false;
const defaultRowLimit = 5;

let fullMap = null;
let fullMarkersLayer = null;
let notificationRead = false;

document.addEventListener('DOMContentLoaded', function () {
    setDefaultPeriod();
    initMap();
    loadDashboard();

    const searchInput = document.getElementById('searchInput');

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            renderTable(allSubmissions);
        });
    }
});

socket.on('connect', function () {
    document.getElementById('realtimeStatus').textContent = 'Terhubung';
});

socket.on('disconnect', function () {
    document.getElementById('realtimeStatus').textContent = 'Terputus';
});

socket.on('dashboard_updated', function () {
    notificationRead = false;
    loadDashboard();
});

function setDefaultPeriod() {
    const periodInput = document.getElementById('periodFilter');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    if (!periodInput.value) {
        periodInput.value = `${year}-${month}`;
    }
}

function getQueryParams() {
    const period = document.getElementById('periodFilter').value;

    const params = new URLSearchParams();

    if (period) {
        params.append('period', period);
    }

    return params.toString();
}

async function loadDashboard() {
    try {
        const query = getQueryParams();
        const response = await fetch('/api/submissions?' + query);
        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('Data submissions bukan array:', data);
            allSubmissions = [];
        } else {
            allSubmissions = data.filter(function (item) {
                const status = normalizeText(item.status);
                return status !== 'draft';
            });
        }

        isShowAllRows = false;

        const showAllButton = document.getElementById('showAllButton');
        if (showAllButton) {
            showAllButton.textContent = 'Lihat Semua ›';
        }

        const summary = calculateSummary(allSubmissions);

        renderSummary(summary);
        renderAgeChart(summary.ageGroups);
        renderGenderChart(summary.gender);
        renderHealth(summary);
        renderTable(allSubmissions);
        renderMap(allSubmissions);
        renderInfo();
        renderNotifications();

    } catch (error) {
        console.error('Gagal memuat dashboard:', error);
    }
}

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

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function getAllAnswersByKeyword(answers, keyword) {
    const results = [];

    if (!Array.isArray(answers)) {
        return results;
    }

    answers.forEach(function (item) {
        const question = String(item.questionText || '').toLowerCase();

        if (question.includes(keyword.toLowerCase())) {
            results.push(item.answer);
        }
    });

    return results;
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function calculateSummary(data) {
    const summary = {
        totalKK: data.length,
        totalPenduduk: 0,
        totalBalita: 0,
        totalLansia: 0,
        totalWus: 0,
        totalPus: 0,
        totalIbuHamil: 0,
        totalDisabilitas: 0,
        totalSakitKronis: 0,
        totalPosyanduAktif: 0,
        totalPampers: 0,
        gender: {
            male: 0,
            female: 0
        },
        ageGroups: {
            '0–5 th': 0,
            '6–12 th': 0,
            '13–17 th': 0,
            '18–25 th': 0,
            '26–45 th': 0,
            '46–59 th': 0,
            '≥60 th': 0
        }
    };

    data.forEach(function (item) {
        const answers = item.answers || [];

        console.log('CEK PUS:', {
            namaKK: getAnswer(answers, 'Nama Kepala Keluarga'),
            pusFromAnswers: getNumberAnswer(answers, 'Pria Usia Subur'),
            computedSummary: item.computedSummary,
            pusFromComputed: item.computedSummary?.anggota_keluarga?.pus
        });

        summary.totalPenduduk += getNumberAnswer(answers, 'Jumlah Anggota Keluarga');

        /*
          Ambil nilai rekap dari answers[] terlebih dahulu.
          Ini biasanya berasal dari jawaban/rekap yang tersimpan di form.
        */
        const balitaFromAnswers = getNumberAnswer(answers, 'Jumlah balita');
        const lansiaFromAnswers = getNumberAnswer(answers, 'Lansia');
        const wusFromAnswers = getNumberAnswer(answers, 'Wanita Usia Subur');
        const pusFromAnswers = getNumberAnswer(answers, 'Pria Usia Subur');
        const wusFromMembers = countCategoryFromMembers(answers, 'WUS');
        const pusFromMembers = countCategoryFromMembers(answers, 'PUS');
        const hamilFromAnswers = getNumberAnswer(answers, 'Ibu Hamil');
        const disabilitasFromAnswers = getNumberAnswer(answers, 'Disabilitas');
        const sakitKronisFromAnswers = getNumberAnswer(answers, 'Sakit Kronis');

        /*
          Nilai awal tetap dari answers[].
        */
        let balitaFinal = balitaFromAnswers;
        let lansiaFinal = lansiaFromAnswers;
        let wusFinal = wusFromAnswers;
        let pusFinal = pusFromAnswers;
        let hamilFinal = hamilFromAnswers;
        let disabilitasFinal = disabilitasFromAnswers;
        let sakitKronisFinal = sakitKronisFromAnswers;

        /*
          Jika computedSummary tersedia, ambil nilai terbesar.
          Ini mencegah kasus seperti:
          answers PUS = 1, computedSummary PUS = 2,
          maka yang dipakai adalah 2.
        */
        if (item.computedSummary && item.computedSummary.anggota_keluarga) {
            const s = item.computedSummary.anggota_keluarga;

            balitaFinal = Math.max(balitaFromAnswers, Number(s.balita || 0));
            lansiaFinal = Math.max(lansiaFromAnswers, Number(s.lansia || 0));
            wusFinal = Math.max(wusFinal, wusFromMembers);
            pusFinal = Math.max(pusFinal, pusFromMembers);
            hamilFinal = Math.max(hamilFromAnswers, Number(s.hamil || 0));
            disabilitasFinal = Math.max(disabilitasFromAnswers, Number(s.disabilitas || 0));
            sakitKronisFinal = Math.max(sakitKronisFromAnswers, Number(s.sakit_kronis || 0));
        }

        summary.totalBalita += balitaFinal;
        summary.totalLansia += lansiaFinal;
        summary.totalWus += wusFinal;
        summary.totalPus += pusFinal;
        summary.totalIbuHamil += hamilFinal;
        summary.totalDisabilitas += disabilitasFinal;
        summary.totalSakitKronis += sakitKronisFinal;

        const genderAnswers = getAllAnswersByKeyword(answers, 'Jenis Kelamin');

        genderAnswers.forEach(function (gender) {
            const g = normalizeText(gender);

            if (g.includes('laki')) {
                summary.gender.male += 1;
            }

            if (g.includes('perempuan')) {
                summary.gender.female += 1;
            }
        });

        const ageAnswers = getAllAnswersByKeyword(answers, 'Umur');

        ageAnswers.forEach(function (ageValue) {
            const age = Number(ageValue);

            if (!Number.isFinite(age)) {
                return;
            }

            if (age <= 5) {
                summary.ageGroups['0–5 th'] += 1;
            } else if (age <= 12) {
                summary.ageGroups['6–12 th'] += 1;
            } else if (age <= 17) {
                summary.ageGroups['13–17 th'] += 1;
            } else if (age <= 25) {
                summary.ageGroups['18–25 th'] += 1;
            } else if (age <= 45) {
                summary.ageGroups['26–45 th'] += 1;
            } else if (age <= 59) {
                summary.ageGroups['46–59 th'] += 1;
            } else {
                summary.ageGroups['≥60 th'] += 1;
            }
        });

        const posyandu = getAnswer(answers, 'Aktif dalam kegiatan posyandu');
        if (normalizeText(posyandu).includes('ya')) {
            summary.totalPosyanduAktif += 1;
        }

        const pampers = getAnswer(answers, 'pampers');
        if (normalizeText(pampers).includes('ya')) {
            summary.totalPampers += 1;
        }
    });

    if (summary.totalPenduduk === 0) {
        summary.totalPenduduk = summary.gender.male + summary.gender.female;
    }

    /*
      Cadangan jika total balita/lansia masih 0.
      Ini tetap dipertahankan agar dashboard masih bisa membaca dari umur.
    */
    if (summary.totalBalita === 0) {
        summary.totalBalita = summary.ageGroups['0–5 th'];
    }

    if (summary.totalLansia === 0) {
        summary.totalLansia = summary.ageGroups['≥60 th'];
    }

    return summary;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString('id-ID');
}

function renderSummary(summary) {
    document.getElementById('totalKK').textContent = formatNumber(summary.totalKK);
    document.getElementById('totalPenduduk').textContent = formatNumber(summary.totalPenduduk);
    document.getElementById('totalBalita').textContent = formatNumber(summary.totalBalita);
    document.getElementById('totalLansia').textContent = formatNumber(summary.totalLansia);
    document.getElementById('totalWus').textContent = formatNumber(summary.totalWus);
    document.getElementById('totalPus').textContent = formatNumber(summary.totalPus);
}

function renderHealth(summary) {
    const totalIbuHamilHealth = document.getElementById('totalIbuHamilHealth');
    const totalPosyanduAktif = document.getElementById('totalPosyanduAktif');
    const totalPampers = document.getElementById('totalPampers');
    const totalDisabilitasHealth = document.getElementById('totalDisabilitasHealth');
    const totalSakitKronisHealth = document.getElementById('totalSakitKronisHealth');

    if (totalIbuHamilHealth) {
        totalIbuHamilHealth.textContent = formatNumber(summary.totalIbuHamil);
    }

    if (totalPosyanduAktif) {
        totalPosyanduAktif.textContent = formatNumber(summary.totalPosyanduAktif);
    }

    if (totalPampers) {
        totalPampers.textContent = formatNumber(summary.totalPampers);
    }

    if (totalDisabilitasHealth) {
        totalDisabilitasHealth.textContent = formatNumber(summary.totalDisabilitas);
    }

    if (totalSakitKronisHealth) {
        totalSakitKronisHealth.textContent = formatNumber(summary.totalSakitKronis);
    }

    const healthModal = document.getElementById('healthModal');

    if (healthModal && healthModal.classList.contains('show')) {
        renderHealthTable();
    }
}

function renderAgeChart(ageGroups) {
    const ctx = document.getElementById('ageChart');

    if (ageChart !== null) {
        ageChart.destroy();
    }

    ageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(ageGroups),
            datasets: [
                {
                    label: 'Jumlah Penduduk',
                    data: Object.values(ageGroups),
                    backgroundColor: '#f97316',
                    borderRadius: 8,
                    barThickness: 34
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        usePointStyle: true
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f5f9'
                    },
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderGenderChart(gender) {
    const ctx = document.getElementById('genderChart');
    const total = gender.male + gender.female;

    document.getElementById('maleCount').textContent = `${formatNumber(gender.male)} (${getPercentage(gender.male, total)}%)`;
    document.getElementById('femaleCount').textContent = `${formatNumber(gender.female)} (${getPercentage(gender.female, total)}%)`;

    if (genderChart !== null) {
        genderChart.destroy();
    }

    genderChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Laki-laki', 'Perempuan'],
            datasets: [
                {
                    data: [gender.male, gender.female],
                    backgroundColor: ['#f97316', '#fbbf24'],
                    borderWidth: 0
                }
            ]
        },
        options: {
            cutout: '68%',
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        },
        plugins: [
            {
                id: 'centerText',
                beforeDraw: function (chart) {
                    const width = chart.width;
                    const height = chart.height;
                    const ctx = chart.ctx;

                    ctx.restore();
                    ctx.font = '700 22px Arial';
                    ctx.fillStyle = '#111827';
                    ctx.textBaseline = 'middle';
                    ctx.textAlign = 'center';
                    ctx.fillText(formatNumber(total), width / 2, height / 2 - 8);

                    ctx.font = '14px Arial';
                    ctx.fillStyle = '#6b7280';
                    ctx.fillText('Total', width / 2, height / 2 + 18);
                    ctx.save();
                }
            }
        ]
    });
}

function getPercentage(value, total) {
    if (!total) {
        return '0,0';
    }

    return ((value / total) * 100).toFixed(1).replace('.', ',');
}

function renderTable(data) {
    const tableBody = document.getElementById('submissionTable');
    const searchInput = document.getElementById('searchInput');
    const search = normalizeText(searchInput ? searchInput.value : '');

    tableBody.innerHTML = '';

    let filtered = data.filter(function (item) {
        const answers = item.answers || [];

        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '';
        const noKK = getAnswer(answers, 'No.KK') || item.displayDescription || '';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const alamat = getAnswer(answers, 'Alamat') || '';
        const status = item.status || '';
        const period = item.period || '';

        const namaAnggota = getAllAnswersByKeyword(answers, 'Nama').join(' ');
        const nikAnggota = getAllAnswersByKeyword(answers, 'No.KTP').join(' ');

        const combined = normalizeText(
            namaKK + ' ' +
            noKK + ' ' +
            rt + ' ' +
            rw + ' ' +
            alamat + ' ' +
            namaAnggota + ' ' +
            nikAnggota + ' ' +
            status + ' ' +
            period
        );

        if (search && !combined.includes(search)) {
            return false;
        }

        return true;
    });

    if (!isShowAllRows) {
    filtered = filtered.slice(0, defaultRowLimit);
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-text">Data tidak ditemukan</td>
            </tr>
        `;
        return;
    }

    filtered.forEach(function (item) {
        const answers = item.answers || [];

        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '-';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const anggota = getNumberAnswer(answers, 'Jumlah Anggota Keluarga');
        const status = item.status || '-';
        const kategori = getFamilyCategory(answers, item);
        const tanggal = formatDate(item.submittedAt || item.updatedAt || item.createdAt || item.receivedAt);

        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${namaKK}</td>
            <td>${rt}</td>
            <td>${rw}</td>
            <td>${anggota || '-'}</td>
            <td>${renderStatusBadge(status)}</td>
            <td>${kategori}</td>
            <td>${tanggal}</td>
            <td>
                <button class="action-btn" onclick="openDetailModal('${item.id || item.localId}')">
                    Detail
                </button>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

function renderStatusBadge(status) {
    const s = normalizeText(status);

    if (s === 'draft') {
        return `<span class="badge badge-yellow">Draft</span>`;
    }

    if (s === 'submitted') {
        return `<span class="badge badge-green">Submitted</span>`;
    }

    return `<span class="badge badge-orange">${status || '-'}</span>`;
}

function getFamilyCategory(answers, item) {
    const lansia = getNumberAnswer(answers, 'Lansia');
    const balita = getNumberAnswer(answers, 'Jumlah balita');
    const hamil = getNumberAnswer(answers, 'Ibu Hamil');

    if (hamil > 0) {
        return `<span class="badge badge-pink">Ibu Hamil</span>`;
    }

    if (balita > 0) {
        return `<span class="badge badge-yellow">Ada Balita</span>`;
    }

    if (lansia > 0) {
        return `<span class="badge badge-purple">Ada Lansia</span>`;
    }

    if (item.computedSummary && item.computedSummary.anggota_keluarga) {
        if (Number(item.computedSummary.anggota_keluarga.hamil || 0) > 0) {
            return `<span class="badge badge-pink">Ibu Hamil</span>`;
        }
    }

    return `<span class="badge badge-orange">Keluarga</span>`;
}

function formatDate(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function initMap() {
    map = L.map('map').setView([-7.8459, 112.4781], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
}

function renderMap(data) {
    markersLayer.clearLayers();

    const points = [];

    data.forEach(function (item) {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);

        if (!lat || !lng) {
            return;
        }

        const answers = item.answers || [];
        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '-';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const rtRw = makeRtRw(rt, rw);

        const marker = L.marker([lat, lng]).addTo(markersLayer);

        marker.bindPopup(`
            <strong>${namaKK}</strong><br>
            RT/RW: ${rtRw}<br>
            <button onclick="openDetailModal('${item.id || item.localId}')">Lihat Detail</button>
        `);

        points.push([lat, lng]);
    });

    if (points.length > 0) {
        map.fitBounds(points, {
            padding: [30, 30]
        });
    }
}

function focusMap() {
    document.getElementById('mapModal').classList.add('show');

    setTimeout(function () {
        if (fullMap === null) {
            initFullMap();
        }

        renderFullMap(allSubmissions);

        fullMap.invalidateSize();
    }, 300);
}

function initFullMap() {
    fullMap = L.map('fullMap').setView([-7.8459, 112.4781], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(fullMap);

    fullMarkersLayer = L.layerGroup().addTo(fullMap);
}

function renderFullMap(data) {
    if (!fullMarkersLayer) {
        return;
    }

    fullMarkersLayer.clearLayers();

    const points = [];

    data.forEach(function (item) {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);

        if (!lat || !lng) {
            return;
        }

        const answers = item.answers || [];
        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '-';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const rtRw = makeRtRw(rt, rw);
        const alamat = getAnswer(answers, 'Alamat') || item.locationAddress || '-';

        const marker = L.marker([lat, lng]).addTo(fullMarkersLayer);

        marker.bindPopup(`
            <strong>${namaKK}</strong><br>
            RT/RW: ${rtRw}<br>
            Alamat: ${alamat}<br><br>
            <button onclick="openDetailModal('${item.id || item.localId}')">Lihat Detail</button>
            <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="display:inline-block;margin-left:6px;color:#f97316;font-weight:bold;">
                Google Maps
            </a>
        `);

        points.push([lat, lng]);
    });

    if (points.length > 0) {
        fullMap.fitBounds(points, {
            padding: [40, 40]
        });
    }
}

function closeMapModal() {
    document.getElementById('mapModal').classList.remove('show');
}

function renderInfo() {
    const lastUpdated = document.getElementById('lastUpdated');
    const statusDataAktif = document.getElementById('statusDataAktif');
    const desaAktif = document.getElementById('desaAktif');
    const realtimeStatus = document.getElementById('realtimeStatus');

    const period = document.getElementById('periodFilter').value || '-';
    const now = new Date();

    if (statusDataAktif) {
        statusDataAktif.textContent = 'Submitted';
    }

    if (desaAktif) {
        desaAktif.textContent = period;
    }

    if (realtimeStatus) {
        realtimeStatus.textContent = 'Terhubung';
    }

    if (lastUpdated) {
        lastUpdated.textContent = now.toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    const settingsModal = document.getElementById('settingsModal');

    if (settingsModal && settingsModal.classList.contains('show')) {
        renderSettingsModal();
    }
}

function closeOtherModalsBeforeDetail() {
    const modalIds = [
        'allRowsModal',
        'healthModal',
        'populationModal',
        'houseModal',
        'reportModal',
        'mapModal',
        'settingsModal'
    ];

    modalIds.forEach(function (modalId) {
        const modal = document.getElementById(modalId);

        if (modal && modal.classList.contains('show')) {
            modal.classList.remove('show');
        }
    });
}

function delay(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

async function openDetailModal(id) {
    try {
        closeOtherModalsBeforeDetail();

         await delay(220);

        const response = await fetch('/api/submissions/' + id);
        const item = await response.json();

        const answers = item.answers || [];

        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '-';
        const noKK = getAnswer(answers, 'No.KK') || item.displayDescription || '-';
        const alamat = getAnswer(answers, 'Alamat') || '-';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const rtRw = makeRtRw(rt, rw);
        const jumlahAnggota = getAnswer(answers, 'Jumlah Anggota Keluarga') || '-';

        let imageHtml = '';

        if (Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
            imageHtml = item.imageUrls.map(function (url) {
                return `<img src="${url}" style="width:100%;max-width:260px;border-radius:14px;margin:8px;border:1px solid #eee;">`;
            }).join('');
        } else if (item.imageUrl) {
            imageHtml = `<img src="${item.imageUrl}" style="width:100%;max-width:260px;border-radius:14px;margin:8px;border:1px solid #eee;">`;
        } else {
            imageHtml = `<p style="color:#6b7280;">Foto belum tersedia.</p>`;
        }

        let locationHtml = `<p style="color:#6b7280;">Lokasi belum tersedia.</p>`;

        if (item.latitude && item.longitude) {
            locationHtml = `
                <a href="https://www.google.com/maps?q=${item.latitude},${item.longitude}" target="_blank" class="action-btn">
                    Buka di Google Maps
                </a>
            `;
        }

        document.getElementById('detailContent').innerHTML = `
            <div class="detail-section">
                <h4>Identitas Keluarga</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <p>Nama Kepala Keluarga</p>
                        <strong>${namaKK}</strong>
                    </div>
                    <div class="detail-item">
                        <p>No KK</p>
                        <strong>${noKK}</strong>
                    </div>
                    <div class="detail-item">
                        <p>RT/RW</p>
                        <strong>${rtRw}</strong>
                    </div>
                    <div class="detail-item">
                        <p>Jumlah Anggota</p>
                        <strong>${jumlahAnggota}</strong>
                    </div>
                    <div class="detail-item">
                        <p>Periode</p>
                        <strong>${item.period || '-'}</strong>
                    </div>
                    <div class="detail-item">
                        <p>Status</p>
                        <strong>${item.status || '-'}</strong>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Alamat</h4>
                <div class="detail-item">
                    <p>Alamat Lengkap</p>
                    <strong>${alamat}</strong>
                </div>
            </div>

            <div class="detail-section">
                <h4>Foto Rumah</h4>
                ${imageHtml}
            </div>

            <div class="detail-section">
                <h4>Lokasi Rumah</h4>
                ${locationHtml}
            </div>
        `;

        document.getElementById('detailModal').classList.add('show');
    } catch (error) {
        console.error('Gagal membuka detail:', error);
        alert('Gagal membuka detail data.');
    }
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('show');
}

function showAllRows() {
    isShowAllRows = !isShowAllRows;

    const button = document.getElementById('showAllButton');

    if (button) {
        if (isShowAllRows) {
            button.textContent = 'Tampilkan 5 Data ›';
        } else {
            button.textContent = 'Lihat Semua ›';
        }
    }

    renderTable(allSubmissions);
}

function exportCSV() {
    if (!Array.isArray(allSubmissions) || allSubmissions.length === 0) {
        alert('Tidak ada data untuk diunduh.');
        return;
    }

    const rows = allSubmissions.map(function (item) {
        return flattenSubmission(item);
    });

    const headers = collectHeaders(rows);

    const csvRows = [];

    csvRows.push(headers.map(escapeCSV).join(','));

    rows.forEach(function (row) {
        const values = headers.map(function (header) {
            return escapeCSV(row[header] || '');
        });

        csvRows.push(values.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');

    const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const period = document.getElementById('periodFilter').value || 'semua-periode';

    link.href = url;
    link.download = 'laporan_lengkap_pendataan_desa_' + period + '.csv';
    link.click();

    URL.revokeObjectURL(url);
}

function flattenSubmission(item) {
    const row = {};

    row['ID'] = item.id || item.localId || '';
    row['Form ID'] = item.formId || '';
    row['Judul Form'] = item.formTitle || '';
    row['User ID'] = item.userId || '';
    row['User Name'] = item.userName || '';
    row['Periode'] = item.period || '';
    row['Village ID'] = item.villageId || '';
    row['Nama Desa'] = item.villageName || '';
    row['Status'] = item.status || '';
    row['Submitted At'] = item.submittedAt || '';
    row['Created At'] = item.createdAt || '';
    row['Updated At'] = item.updatedAt || '';
    row['Received At'] = item.receivedAt || '';
    row['Is Locked'] = item.isLocked === true ? 'Ya' : 'Tidak';
    row['Is Auto Generated'] = item.isAutoGenerated === true ? 'Ya' : 'Tidak';

    row['Latitude'] = item.latitude || '';
    row['Longitude'] = item.longitude || '';
    row['Alamat Lokasi'] = item.locationAddress || '';
    row['Akurasi Lokasi'] = item.locationAccuracy || '';

    row['Image URL Utama'] = item.imageUrl || '';

    if (Array.isArray(item.imageUrls)) {
        row['Semua Image URL'] = item.imageUrls.join(' | ');
    } else {
        row['Semua Image URL'] = '';
    }

    if (item.computedSummary && item.computedSummary.anggota_keluarga) {
        const s = item.computedSummary.anggota_keluarga;

        row['Summary PUS'] = s.pus || 0;
        row['Summary WUS'] = s.wus || 0;
        row['Summary Ibu Hamil'] = s.hamil || 0;
        row['Summary Disabilitas'] = s.disabilitas || 0;
        row['Summary Sakit Kronis'] = s.sakit_kronis || 0;
    }

    if (Array.isArray(item.answers)) {
        item.answers.forEach(function (answerItem) {
            const questionText = cleanHeader(answerItem.questionText || 'Pertanyaan Tanpa Nama');
            const questionId = answerItem.questionId || '';
            const columnName = makeUniqueColumnName(row, questionText, questionId);

            row[columnName] = formatAnswerForCSV(answerItem.answer);
        });
    }

    return row;
}

function makeUniqueColumnName(row, questionText, questionId) {
    if (!row.hasOwnProperty(questionText)) {
        return questionText;
    }

    if (questionId) {
        const suffixMatch = questionId.match(/_(\d+)$/);

        if (suffixMatch) {
            const index = Number(suffixMatch[1]) + 1;
            const indexedName = questionText + ' ' + index;

            if (!row.hasOwnProperty(indexedName)) {
                return indexedName;
            }
        }
    }

    let counter = 2;
    let newName = questionText + ' ' + counter;

    while (row.hasOwnProperty(newName)) {
        counter++;
        newName = questionText + ' ' + counter;
    }

    return newName;
}

function formatAnswerForCSV(answer) {
    if (answer === null || answer === undefined) {
        return '';
    }

    if (Array.isArray(answer)) {
        return answer.join(' | ');
    }

    if (typeof answer === 'object') {
        if (answer.type === 'imageUpload') {
            return answer.imageUrl || answer.localPath || '';
        }

        if (answer.type === 'location') {
            const latitude = answer.latitude || '';
            const longitude = answer.longitude || '';
            const accuracy = answer.accuracy || '';

            return 'Lat: ' + latitude + ', Lng: ' + longitude + ', Accuracy: ' + accuracy;
        }

        return JSON.stringify(answer);
    }

    return String(answer);
}

function collectHeaders(rows) {
    const headers = [];

    rows.forEach(function (row) {
        Object.keys(row).forEach(function (key) {
            if (!headers.includes(key)) {
                headers.push(key);
            }
        });
    });

    return headers;
}

function cleanHeader(value) {
    return String(value)
        .replace(/\s+/g, ' ')
        .replace(/\n/g, ' ')
        .trim();
}

function escapeCSV(value) {
    const text = String(value)
        .replace(/"/g, '""')
        .replace(/\r?\n|\r/g, ' ');

    return '"' + text + '"';
}

function openAllRowsModal() {
    const modal = document.getElementById('allRowsModal');
    const searchInput = document.getElementById('allRowsSearchInput');

    if (!modal) {
        return;
    }

    modal.classList.add('show');

    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();

        searchInput.oninput = function () {
            renderAllRowsTable();
        };
    }

    renderAllRowsTable();
}

function closeAllRowsModal() {
    const modal = document.getElementById('allRowsModal');

    if (modal) {
        modal.classList.remove('show');
    }
}

function renderAllRowsTable() {
    const tableBody = document.getElementById('allRowsTable');
    const totalText = document.getElementById('allRowsTotal');
    const searchInput = document.getElementById('allRowsSearchInput');

    if (!tableBody) {
        return;
    }

    const search = normalizeText(searchInput ? searchInput.value : '');

    tableBody.innerHTML = '';

    let filtered = allSubmissions.filter(function (item) {
        const answers = item.answers || [];

        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '';
        const noKK = getAnswer(answers, 'No.KK') || item.displayDescription || '';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const alamat = getAnswer(answers, 'Alamat') || '';
        const status = item.status || '';
        const period = item.period || '';

        const namaAnggota = getAllAnswersByKeyword(answers, 'Nama').join(' ');
        const nikAnggota = getAllAnswersByKeyword(answers, 'No.KTP').join(' ');

        const combined = normalizeText(
            namaKK + ' ' +
            noKK + ' ' +
            rt + ' ' +
            rw + ' ' +
            alamat + ' ' +
            namaAnggota + ' ' +
            nikAnggota + ' ' +
            status + ' ' +
            period
        );

        if (search && !combined.includes(search)) {
            return false;
        }

        return true;
    });

    if (totalText) {
        totalText.textContent = 'Total data: ' + filtered.length;
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-text">Data tidak ditemukan</td>
            </tr>
        `;
        return;
    }

    filtered.forEach(function (item) {
        const answers = item.answers || [];

        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '-';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const anggota = getNumberAnswer(answers, 'Jumlah Anggota Keluarga');
        const status = item.status || '-';
        const kategori = getFamilyCategory(answers, item);
        const tanggal = formatDate(item.submittedAt || item.updatedAt || item.createdAt || item.receivedAt);

        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${namaKK}</td>
            <td>${rt}</td>
            <td>${rw}</td>
            <td>${anggota || '-'}</td>
            <td>${renderStatusBadge(status)}</td>
            <td>${kategori}</td>
            <td>${tanggal}</td>
            <td>
                <button class="action-btn" onclick="openDetailModal('${item.id || item.localId}')">
                    Detail
                </button>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');

    if (!panel) {
        return;
    }

    panel.classList.toggle('show');

    renderNotifications();

    if (panel.classList.contains('show')) {
        markNotificationsAsRead();
    }
}

function markNotificationsAsRead() {
    notificationRead = true;

    const count = document.getElementById('notificationCount');

    if (count) {
        count.textContent = '0';
        count.style.display = 'none';
    }
}

function closeNotificationPanel() {
    const panel = document.getElementById('notificationPanel');

    if (panel) {
        panel.classList.remove('show');
    }
}

function renderNotifications() {
    const list = document.getElementById('notificationList');
    const count = document.getElementById('notificationCount');

    if (!list) {
        return;
    }

    const notifications = buildNotifications();

    if (count) {
    if (notificationRead) {
        count.textContent = '0';
        count.style.display = 'none';
    } else {
        count.textContent = notifications.length;

        if (notifications.length > 0) {
            count.style.display = 'grid';
        } else {
            count.style.display = 'none';
        }
    }
    }

    list.innerHTML = '';

    if (notifications.length === 0) {
        list.innerHTML = '<p class="empty-notification">Belum ada notifikasi</p>';
        return;
    }

    notifications.forEach(function (item) {
        const div = document.createElement('div');
        div.className = 'notification-item';

        div.innerHTML = `
            <h5>${item.title}</h5>
            <p>${item.message}</p>
            <small>${item.time}</small>
        `;

        list.appendChild(div);
    });
}

function buildNotifications() {
    const notifications = [];

    const totalData = Array.isArray(allSubmissions) ? allSubmissions.length : 0;

    if (totalData > 0) {
        notifications.push({
            title: 'Data terbaru masuk',
            message: totalData + ' data submitted tersedia pada dashboard.',
            time: 'Baru saja'
        });
    }

    const todayData = getTodaySubmissionCount();

    if (todayData > 0) {
        notifications.push({
            title: 'Input data hari ini',
            message: todayData + ' data masuk hari ini.',
            time: 'Hari ini'
        });
    }

    const incompleteLocation = getIncompleteLocationCount();

    if (incompleteLocation > 0) {
        notifications.push({
            title: 'Lokasi belum lengkap',
            message: incompleteLocation + ' data belum memiliki latitude dan longitude.',
            time: 'Perlu dicek'
        });
    }

    return notifications;
}

function getTodaySubmissionCount() {
    if (!Array.isArray(allSubmissions)) {
        return 0;
    }

    const today = new Date().toISOString().slice(0, 10);
    let count = 0;

    allSubmissions.forEach(function (item) {
        const dateText = String(item.submittedAt || item.createdAt || item.receivedAt || '');

        if (dateText.startsWith(today)) {
            count++;
        }
    });

    return count;
}

function getIncompleteLocationCount() {
    if (!Array.isArray(allSubmissions)) {
        return 0;
    }

    let count = 0;

    allSubmissions.forEach(function (item) {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);

        if (!lat || !lng) {
            count++;
        }
    });

    return count;
}

function openReportModal() {
    const modal = document.getElementById('reportModal');

    if (!modal) {
        return;
    }

    modal.classList.add('show');

    const reportType = document.getElementById('reportType');
    const reportPeriod = document.getElementById('reportPeriod');
    const reportRtFilter = document.getElementById('reportRtFilter');
    const reportSearch = document.getElementById('reportSearch');
    const dashboardPeriod = document.getElementById('periodFilter');

    /*
      Saat modal dibuka, periode laporan otomatis mengikuti
      periode yang sedang dipilih di dashboard utama.
    */
    if (reportPeriod && dashboardPeriod) {
        reportPeriod.value = dashboardPeriod.value;
    }

    if (reportType) {
        reportType.onchange = renderReportPreview;
    }

    if (reportPeriod) {
        reportPeriod.onchange = renderReportPreview;
    }

    if (reportRtFilter) {
        reportRtFilter.oninput = renderReportPreview;
    }

    if (reportSearch) {
        reportSearch.oninput = renderReportPreview;
    }

    renderReportPreview();
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');

    if (modal) {
        modal.classList.remove('show');
    }
}

function resetReportFilter() {
    const reportType = document.getElementById('reportType');
    const reportPeriod = document.getElementById('reportPeriod');
    const reportRtFilter = document.getElementById('reportRtFilter');
    const reportSearch = document.getElementById('reportSearch');
    const dashboardPeriod = document.getElementById('periodFilter');

    if (reportType) {
        reportType.value = 'lengkap';
    }

    if (reportPeriod && dashboardPeriod) {
        reportPeriod.value = dashboardPeriod.value;
    }

    if (reportRtFilter) {
        reportRtFilter.value = '';
    }

    if (reportSearch) {
        reportSearch.value = '';
    }

    renderReportPreview();
}

function getFilteredReportData() {
    const reportPeriod = document.getElementById('reportPeriod');
    const reportRtFilter = document.getElementById('reportRtFilter');
    const reportSearch = document.getElementById('reportSearch');

    const selectedPeriod = reportPeriod ? reportPeriod.value : '';
    const selectedRt = normalizeText(reportRtFilter ? reportRtFilter.value : '');
    const search = normalizeText(reportSearch ? reportSearch.value : '');

    if (!Array.isArray(allSubmissions)) {
        return [];
    }

    return allSubmissions.filter(function (item) {
        const answers = item.answers || [];

        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '';
        const noKK = getAnswer(answers, 'No.KK') || item.displayDescription || '';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const alamat = getAnswer(answers, 'Alamat') || '';
        const status = item.status || '';
        const period = item.period || '';

        const namaAnggota = getAllAnswersByKeyword(answers, 'Nama').join(' ');
        const nikAnggota = getAllAnswersByKeyword(answers, 'No.KTP').join(' ');

        /*
          Data yang tampil dan terunduh hanya sesuai periode
          yang dipilih pada modal laporan.
        */
        if (selectedPeriod && period !== selectedPeriod) {
            return false;
        }

        if (selectedRt && !normalizeText(rt).includes(selectedRt)) {
            return false;
        }

        const combined = normalizeText(
            namaKK + ' ' +
            noKK + ' ' +
            rt + ' ' +
            rw + ' ' +
            alamat + ' ' +
            namaAnggota + ' ' +
            nikAnggota + ' ' +
            status + ' ' +
            period
        );

        if (search && !combined.includes(search)) {
            return false;
        }

        return true;
    });
}

function renderReportPreview() {
    const tableHead = document.getElementById('reportPreviewHead');
    const tableBody = document.getElementById('reportPreviewBody');
    const previewInfo = document.getElementById('reportPreviewInfo');
    const reportType = document.getElementById('reportType');

    if (!tableHead || !tableBody) {
        return;
    }

    const type = reportType ? reportType.value : 'lengkap';
    const filtered = getFilteredReportData();
    const previewData = filtered.slice(0, 10);

    if (previewInfo) {
        previewInfo.textContent = 'Total data preview: ' + filtered.length;
    }

    tableBody.innerHTML = '';

    if (type === 'kesehatan') {
        tableHead.innerHTML = `
            <tr>
                <th>Nama KK</th>
                <th>RT</th>
                <th>RW</th>
                <th>Ibu Hamil</th>
                <th>Balita</th>
                <th>Lansia</th>
                <th>Pampers</th>
            </tr>
        `;
    } else if (type === 'lokasi') {
        tableHead.innerHTML = `
            <tr>
                <th>Nama KK</th>
                <th>RT</th>
                <th>RW</th>
                <th>Alamat</th>
                <th>Latitude</th>
                <th>Longitude</th>
            </tr>
        `;
    } else {
        tableHead.innerHTML = `
            <tr>
                <th>Nama KK</th>
                <th>No KK</th>
                <th>RT</th>
                <th>RW</th>
                <th>Anggota</th>
                <th>Status</th>
                <th>Tanggal Input</th>
            </tr>
        `;
    }

    if (previewData.length === 0) {
        const colspan = type === 'kesehatan' || type === 'lokasi' ? 6 : 6;

        tableBody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="empty-text">Data tidak ditemukan</td>
            </tr>
        `;
        return;
    }

    previewData.forEach(function (item) {
        const answers = item.answers || [];

        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '-';
        const noKK = getAnswer(answers, 'No.KK') || item.displayDescription || '-';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const alamat = getAnswer(answers, 'Alamat') || item.locationAddress || '-';
        const anggota = getNumberAnswer(answers, 'Jumlah Anggota Keluarga') || '-';
        const status = item.status || '-';
        const tanggal = formatDate(item.submittedAt || item.updatedAt || item.createdAt || item.receivedAt);

        const tr = document.createElement('tr');

        if (type === 'kesehatan') {
            const ibuHamil = getNumberAnswer(answers, 'Ibu Hamil');
            const balita = getNumberAnswer(answers, 'Jumlah balita');
            const lansia = getNumberAnswer(answers, 'Lansia');
            const pampers = getAnswer(answers, 'pampers') || '-';

            tr.innerHTML = `
                <td>${namaKK}</td>
                <td>${rt}</td>
                <td>${rw}</td>
                <td>${ibuHamil}</td>
                <td>${balita}</td>
                <td>${lansia}</td>
                <td>${pampers}</td>
            `;
        } else if (type === 'lokasi') {
            tr.innerHTML = `
                <td>${namaKK}</td>
                <td>${rt}</td>
                <td>${rw}</td>
                <td>${alamat}</td>
                <td>${item.latitude || '-'}</td>
                <td>${item.longitude || '-'}</td>
            `;
        } else {
            tr.innerHTML = `
                <td>${namaKK}</td>
                <td>${noKK}</td>
                <td>${rt}</td>
                <td>${rw}</td>
                <td>${anggota}</td>
                <td>${status}</td>
                <td>${tanggal}</td>
            `;
        }

        tableBody.appendChild(tr);
    });
}

function downloadReportCSV() {
    const filtered = getFilteredReportData();

    if (!Array.isArray(filtered) || filtered.length === 0) {
        alert('Tidak ada data laporan untuk diunduh.');
        return;
    }

    exportCSVWithData(filtered);
}

function exportCSVWithData(data) {
    const reportType = document.getElementById('reportType');
    const type = reportType ? reportType.value : 'lengkap';

    const rows = data.map(function (item) {
        if (type === 'keluarga') {
            return flattenFamilyReport(item);
        }

        if (type === 'penduduk') {
            return flattenPopulationReport(item);
        }

        if (type === 'kesehatan') {
            return flattenHealthReport(item);
        }

        if (type === 'lokasi') {
            return flattenLocationReport(item);
        }

        return flattenSubmission(item);
    });

    const headers = collectHeaders(rows);
    const csvRows = [];

    csvRows.push(headers.map(escapeCSV).join(','));

    rows.forEach(function (row) {
        const values = headers.map(function (header) {
            return escapeCSV(row[header] || '');
        });

        csvRows.push(values.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');

    const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const reportPeriod = document.getElementById('reportPeriod');
    const period = reportPeriod && reportPeriod.value ? reportPeriod.value : 'semua-periode';

    link.href = url;
    link.download = 'laporan_' + type + '_pendataan_desa_' + period + '.csv';
    link.click();

    URL.revokeObjectURL(url);
}

function flattenFamilyReport(item) {
    const answers = item.answers || [];

    return {
        'Nama Kepala Keluarga': getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '',
        'No KK': getAnswer(answers, 'No.KK') || item.displayDescription || '',
        'RT': item.rt || getAnswer(answers, 'RT') || '',
        'RW': item.rw || getAnswer(answers, 'RW') || '',
        'Alamat': getAnswer(answers, 'Alamat') || '',
        'Jumlah Anggota': getNumberAnswer(answers, 'Jumlah Anggota Keluarga'),
        'Status': item.status || '',
        'Periode': item.period || '',
        'Tanggal Input': item.submittedAt || item.createdAt || item.receivedAt || ''
    };
}

function flattenPopulationReport(item) {
    const answers = item.answers || [];

    return {
        'Nama Kepala Keluarga': getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '',
        'No KK': getAnswer(answers, 'No.KK') || item.displayDescription || '',
        'RT': item.rt || getAnswer(answers, 'RT') || '',
        'RW': item.rw || getAnswer(answers, 'RW') || '',
        'Jumlah Anggota': getNumberAnswer(answers, 'Jumlah Anggota Keluarga'),
        'Total Balita': getNumberAnswer(answers, 'Jumlah balita'),
        'Total Lansia': getNumberAnswer(answers, 'Lansia'),
        'Wanita Usia Subur': getNumberAnswer(answers, 'Wanita Usia Subur'),
        'Pria Usia Subur': getNumberAnswer(answers, 'Pria Usia Subur'),
        'Periode': item.period || '',
        'Status': item.status || ''
    };
}

function flattenHealthReport(item) {
    const answers = item.answers || [];

    const jenisDisabilitas = getHealthTextFromSubmission(answers, [
        'jenis disabilitas',
        'macam disabilitas',
        'tipe disabilitas',
        'disabilitas yang dialami',
        'keterangan disabilitas'
    ]);

    const jenisSakitKronis = getHealthTextFromSubmission(answers, [
        'jenis penyakit kronis',
        'nama penyakit kronis',
        'riwayat penyakit kronis',
        'sakit kronis yang diderita',
        'keterangan sakit kronis'
    ]);

    return {
        'Nama Kepala Keluarga': getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '',
        'RT': item.rt || getAnswer(answers, 'RT') || '',
        'RW': item.rw || getAnswer(answers, 'RW') || '',
        'Ibu Hamil': getNumberAnswer(answers, 'Ibu Hamil'),
        'Balita': getNumberAnswer(answers, 'Jumlah balita'),
        'Lansia': getNumberAnswer(answers, 'Lansia'),
        'Disabilitas': getNumberAnswer(answers, 'Disabilitas'),
        'Jenis Disabilitas': jenisDisabilitas,
        'Sakit Kronis': getNumberAnswer(answers, 'Sakit Kronis'),
        'Jenis Penyakit Kronis': jenisSakitKronis,
        'Pampers': getAnswer(answers, 'pampers') || '',
        'Aktif Posyandu': getAnswer(answers, 'Aktif dalam kegiatan posyandu') || '',
        'Periode': item.period || ''
    };
}

function flattenLocationReport(item) {
    const answers = item.answers || [];

    return {
        'Nama Kepala Keluarga': getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '',
        'RT': item.rt || getAnswer(answers, 'RT') || '',
        'RW': item.rw || getAnswer(answers, 'RW') || '',
        'Alamat': getAnswer(answers, 'Alamat') || item.locationAddress || '',
        'Latitude': item.latitude || '',
        'Longitude': item.longitude || '',
        'Akurasi Lokasi': item.locationAccuracy || '',
        'Google Maps': item.latitude && item.longitude ? 'https://www.google.com/maps?q=' + item.latitude + ',' + item.longitude : '',
        'Periode': item.period || ''
    };
}

function openPopulationModal() {
    const modal = document.getElementById('populationModal');

    if (!modal) {
        return;
    }

    modal.classList.add('show');

    const genderFilter = document.getElementById('populationGenderFilter');
    const ageFilter = document.getElementById('populationAgeFilter');
    const rtRwFilter = document.getElementById('populationRtFilter');
    const searchInput = document.getElementById('populationSearchInput');

    if (genderFilter) {
        genderFilter.onchange = renderPopulationTable;
    }

    if (ageFilter) {
        ageFilter.onchange = renderPopulationTable;
    }

    if (rtRwFilter) {
        rtRwFilter.oninput = renderPopulationTable;
    }

    if (searchInput) {
        searchInput.oninput = renderPopulationTable;
        searchInput.focus();
    }

    renderPopulationTable();
}

function closePopulationModal() {
    const modal = document.getElementById('populationModal');

    if (modal) {
        modal.classList.remove('show');
    }
}

function resetPopulationFilter() {
    const genderFilter = document.getElementById('populationGenderFilter');
    const ageFilter = document.getElementById('populationAgeFilter');
    const rtRwFilter = document.getElementById('populationRtFilter');
    const searchInput = document.getElementById('populationSearchInput');

    if (genderFilter) {
        genderFilter.value = 'semua';
    }

    if (ageFilter) {
        ageFilter.value = 'semua';
    }

    if (rtRwFilter) {
        rtRwFilter.value = '';
    }

    if (searchInput) {
        searchInput.value = '';
    }

    renderPopulationTable();
}

/*
  Fungsi ini mengubah data keluarga menjadi data individu.
  Setiap submission/KK bisa menghasilkan beberapa baris penduduk.
*/
function buildPopulationRows() {
    const rows = [];

    if (!Array.isArray(allSubmissions)) {
        return rows;
    }

    allSubmissions.forEach(function (item) {
        const answers = item.answers || [];

        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '-';
        const noKK = getAnswer(answers, 'No.KK') || item.displayDescription || '-';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const alamat = getAnswer(answers, 'Alamat') || '-';
        const jumlahAnggota = getNumberAnswer(answers, 'Jumlah Anggota Keluarga');

        const names = getMemberAnswersOnly(answers, [
            'nama anggota',
            'nama lengkap anggota',
            'nama penduduk',
            'nama'
        ]);

        const niks = getMemberAnswersOnly(answers, [
            'no.ktp',
            'no ktp',
            'nik',
            'nomor ktp'
        ]);

        const genders = getMemberAnswersOnly(answers, [
            'jenis kelamin'
        ]);

        const ages = getMemberAnswersOnly(answers, [
            'umur',
            'usia'
        ]);

        const relations = getMemberAnswersOnly(answers, [
            'jabatan',
            'Status dalam keluarga',
            'hubungan dengan kepala keluarga',
            'Status dalam keluarga ',
            'hubungan keluarga'
        ]);

        /*
          Batas jumlah baris mengikuti Jumlah Anggota Keluarga.
          Jadi kalau total anggota 3, maksimal hanya 3 baris yang tampil.
        */
        const maxLength = jumlahAnggota > 0 ? jumlahAnggota : Math.max(
            names.length,
            niks.length,
            genders.length,
            ages.length,
            relations.length
        );

        for (let i = 0; i < maxLength; i++) {
            rows.push({
                nama: names[i] || '-',
                nik: niks[i] || '-',
                gender: genders[i] || '-',
                umur: ages[i] || '',
                kategori: getAgeCategoryForPopulation(ages[i], genders[i]),
                statusKk: relations[i] || '-',
                rt: rt,
                rw: rw,
                namaKK: namaKK,
                noKK: noKK,
                alamat: alamat,
                submissionId: item.id || item.localId || ''
            });
        }
    });

    return rows;
}
function getMemberAnswersOnly(answers, keywords) {
    const results = [];

    if (!Array.isArray(answers)) {
        return results;
    }

    answers.forEach(function (item) {
        const question = normalizeText(item.questionText || '');

        const isMatch = keywords.some(function (keyword) {
            const key = normalizeText(keyword);
            return question === key || question.includes(key);
        });

        if (!isMatch) {
            return;
        }

        /*
          Jangan ambil data identitas keluarga/rumah.
          Ini yang menyebabkan nama selain anggota ikut tampil.
        */
        if (question.includes('nama kepala keluarga')) {
            return;
        }

        if (question.includes('nama kk')) {
            return;
        }

        if (question.includes('nama desa')) {
            return;
        }

        if (question.includes('nama dusun')) {
            return;
        }

        if (question.includes('nama rt')) {
            return;
        }

        if (question.includes('nama rw')) {
            return;
        }

        if (question.includes('jumlah anggota keluarga')) {
            return;
        }

        if (question.includes('jumlah balita')) {
            return;
        }

        if (question.includes('jumlah lansia')) {
            return;
        }

        if (question.includes('wanita usia subur')) {
            return;
        }

        if (question.includes('pria usia subur')) {
            return;
        }

        /*
          Kalau ada field bertipe rekap, jangan dimasukkan sebagai penduduk.
        */
        if (question.includes('total')) {
            return;
        }

        results.push(item.answer);
    });

    return results;
}

function getPopulationAnswersByExactKeyword(answers, keywords) {
    const results = [];

    if (!Array.isArray(answers)) {
        return results;
    }

    answers.forEach(function (item) {
        const question = normalizeText(item.questionText || '');

        const isMatch = keywords.some(function (keyword) {
            return question === normalizeText(keyword) || question.includes(normalizeText(keyword));
        });

        if (!isMatch) {
            return;
        }

        /*
          Hindari "Nama Kepala Keluarga" ikut masuk sebagai nama penduduk.
        */
        if (question.includes('nama kepala keluarga')) {
            return;
        }

        /*
          Hindari "Jumlah Anggota Keluarga" ikut terbaca sebagai umur/anggota.
        */
        if (question.includes('jumlah anggota keluarga')) {
            return;
        }

        results.push(item.answer);
    });

    return results;
}

function getAgeCategoryForPopulation(ageValue, genderValue) {
    const age = Number(ageValue);
    const gender = normalizeText(genderValue);

    if (!Number.isFinite(age)) {
        return '-';
    }

    if (age <= 5) {
        return 'Balita';
    }

    if (age <= 12) {
        return 'Anak-anak';
    }

    if (age <= 17) {
        return 'Remaja';
    }

    if (age >= 60) {
        return 'Lansia';
    }

    if (gender.includes('perempuan') && age >= 15 && age <= 49) {
        return 'WUS';
    }

    if (gender.includes('laki') && age >= 15 && age <= 64) {
        return 'PUS';
    }

    return 'Dewasa';
}

function countCategoryFromMembers(answers, targetCategory) {
    const genders = getMemberAnswersOnly(answers, [
        'jenis kelamin'
    ]);

    const ages = getMemberAnswersOnly(answers, [
        'umur',
        'usia'
    ]);

    let total = 0;
    const maxLength = Math.max(genders.length, ages.length);

    for (let i = 0; i < maxLength; i++) {
        const category = normalizeText(getAgeCategoryForPopulation(ages[i], genders[i]));

        if (category === normalizeText(targetCategory)) {
            total++;
        }
    }

    return total;
}

function getFilteredPopulationRows() {
    const genderFilter = document.getElementById('populationGenderFilter');
    const ageFilter = document.getElementById('populationAgeFilter');
    const rtFilter = document.getElementById('populationRtFilter');
    const searchInput = document.getElementById('populationSearchInput');

    const selectedGender = normalizeText(genderFilter ? genderFilter.value : 'semua');
    const selectedAge = normalizeText(ageFilter ? ageFilter.value : 'semua');
    const selectedRt = normalizeText(rtFilter ? rtFilter.value : '');
    const search = normalizeText(searchInput ? searchInput.value : '');

    const rows = buildPopulationRows();

    return rows.filter(function (row) {
        const rowGender = normalizeText(row.gender);
        const rowCategory = normalizeText(row.kategori);

        if (selectedGender !== 'semua') {
            if (selectedGender === 'laki' && !rowGender.includes('laki')) {
                return false;
            }

            if (selectedGender === 'perempuan' && !rowGender.includes('perempuan')) {
                return false;
            }
        }

        if (selectedAge !== 'semua') {
            if (selectedAge === 'balita' && rowCategory !== 'balita') {
                return false;
            }

            if (selectedAge === 'anak' && rowCategory !== 'anak-anak') {
                return false;
            }

            if (selectedAge === 'remaja' && rowCategory !== 'remaja') {
                return false;
            }

            if (selectedAge === 'dewasa' && rowCategory !== 'dewasa') {
                return false;
            }

            if (selectedAge === 'lansia' && rowCategory !== 'lansia') {
                return false;
            }

            if (selectedAge === 'wus' && rowCategory !== 'wus') {
                return false;
            }

            if (selectedAge === 'pus' && rowCategory !== 'pus') {
                return false;
            }
        }

        if (selectedRt && !normalizeText(row.rt).includes(selectedRt)) {
            return false;
        }

        const combined = normalizeText(
            row.nama + ' ' +
            row.nik + ' ' +
            row.gender + ' ' +
            row.umur + ' ' +
            row.kategori + ' ' +
            row.statusKk + ' ' +
            row.rt + ' ' +
            row.rw + ' ' +
            row.namaKK + ' ' +
            row.noKK + ' ' +
            row.alamat
        );

        if (search && !combined.includes(search)) {
            return false;
        }

        return true;
    });
}

function renderPopulationSummary(rows) {
    let totalPenduduk = 0;
    let male = 0;
    let female = 0;
    let balita = 0;
    let lansia = 0;
    let wus = 0;

    if (Array.isArray(allSubmissions)) {
        allSubmissions.forEach(function (item) {
            const answers = item.answers || [];
            totalPenduduk += getNumberAnswer(answers, 'Jumlah Anggota Keluarga');
        });
    }

    rows.forEach(function (row) {
        const gender = normalizeText(row.gender);
        const kategori = normalizeText(row.kategori);

        if (gender.includes('laki')) {
            male++;
        }

        if (gender.includes('perempuan')) {
            female++;
        }

        if (kategori === 'balita') {
            balita++;
        }

        if (kategori === 'lansia') {
            lansia++;
        }

        if (kategori === 'wus') {
            wus++;
        }
    });

    if (totalPenduduk === 0) {
        totalPenduduk = rows.length;
    }

    document.getElementById('populationTotal').textContent = formatNumber(totalPenduduk);
    document.getElementById('populationMale').textContent = formatNumber(male);
    document.getElementById('populationFemale').textContent = formatNumber(female);
    document.getElementById('populationBalita').textContent = formatNumber(balita);
    document.getElementById('populationLansia').textContent = formatNumber(lansia);

    const populationWus = document.getElementById('populationWus');

    if (populationWus) {
        populationWus.textContent = formatNumber(wus);
    }
}

function getTotalPopulationFromSubmissions() {
    let total = 0;

    if (!Array.isArray(allSubmissions)) {
        return 0;
    }

    allSubmissions.forEach(function (item) {
        const answers = item.answers || [];
        total += getNumberAnswer(answers, 'Jumlah Anggota Keluarga');
    });

    if (total === 0) {
        return buildPopulationRows().length;
    }

    return total;
}

function renderPopulationTable() {
    const tableBody = document.getElementById('populationTable');
    const totalText = document.getElementById('populationTotalText');

    if (!tableBody) {
        return;
    }

    const rows = getFilteredPopulationRows();

    renderPopulationSummary(rows);

    if (totalText) {
    const totalPenduduk = getTotalPopulationFromSubmissions();
    totalText.textContent = 'Total data: ' + formatNumber(totalPenduduk);
    }

    tableBody.innerHTML = '';

    if (rows.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-text">Data penduduk tidak ditemukan</td>
            </tr>
        `;
        return;
    }

    rows.forEach(function (row) {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${row.nama || '-'}</td>
            <td>${row.nik || '-'}</td>
            <td>${row.gender || '-'}</td>
            <td>${row.umur || '-'}</td>
            <td>${renderPopulationCategoryBadge(row.kategori)}</td>
            <td>${row.statusKk || '-'}</td>
            <td>${row.rt || '-'}</td>
            <td>${row.rw || '-'}</td>
            <td>${row.namaKK || '-'}</td>
        `;

        tableBody.appendChild(tr);
    });
}

function renderPopulationCategoryBadge(category) {
    const c = normalizeText(category);

    if (c === 'balita') {
        return `<span class="badge badge-yellow">Balita</span>`;
    }

    if (c === 'anak-anak') {
        return `<span class="badge badge-orange">Anak-anak</span>`;
    }

    if (c === 'remaja') {
        return `<span class="badge badge-green">Remaja</span>`;
    }

    if (c === 'lansia') {
        return `<span class="badge badge-purple">Lansia</span>`;
    }

    if (c === 'wus') {
        return `<span class="badge badge-pink">WUS</span>`;
    }

    if (c === 'pus') {
        return `<span class="badge badge-orange">PUS</span>`;
    }

    return `<span class="badge badge-green">Dewasa</span>`;
}

/* ===============================
   HEALTH MODAL
   Untuk menu Rekap Kesehatan
================================ */

function openHealthModal() {
    const modal = document.getElementById('healthModal');

    if (!modal) {
        return;
    }

    modal.classList.add('show');

    const categoryFilter = document.getElementById('healthCategoryFilter');
    const rtFilter = document.getElementById('healthRtFilter');
    const searchInput = document.getElementById('healthSearchInput');

    if (categoryFilter) {
        categoryFilter.onchange = renderHealthTable;
    }

    if (rtFilter) {
        rtFilter.oninput = renderHealthTable;
    }

    if (searchInput) {
        searchInput.oninput = renderHealthTable;
        searchInput.focus();
    }

    renderHealthTable();
}

function closeHealthModal() {
    const modal = document.getElementById('healthModal');

    if (modal) {
        modal.classList.remove('show');
    }
}

function resetHealthFilter() {
    const categoryFilter = document.getElementById('healthCategoryFilter');
    const rtFilter = document.getElementById('healthRtFilter');
    const searchInput = document.getElementById('healthSearchInput');

    if (categoryFilter) {
        categoryFilter.value = 'semua';
    }

    if (rtFilter) {
        rtFilter.value = '';
    }

    if (searchInput) {
        searchInput.value = '';
    }

    renderHealthTable();
}

function getHealthNumberFromSubmission(item, answers, keyword, computedKey) {
    let value = getNumberAnswer(answers, keyword);

    if (value > 0) {
        return value;
    }

    if (
        item &&
        item.computedSummary &&
        item.computedSummary.anggota_keluarga &&
        computedKey
    ) {
        value = Number(item.computedSummary.anggota_keluarga[computedKey] || 0);

        if (Number.isFinite(value)) {
            return value;
        }
    }

    return 0;
}

function getHealthTextFromSubmission(answers, keywords) {
    let results = [];

    if (!Array.isArray(answers)) {
        return '-';
    }

    answers.forEach(function (item) {
        const question = normalizeText(item.questionText || '');

        const isMatch = keywords.some(function (keyword) {
            const key = normalizeText(keyword);
            return question.includes(key);
        });

        if (!isMatch) {
            return;
        }

        const value = item.answer;

        if (value === null || value === undefined || value === '') {
            return;
        }

        const pushValue = function (v) {
            const text = String(v || '').trim();
            const normalized = normalizeText(text);

            if (!text) return;

            // Jangan masukkan jawaban ya/tidak/angka ke kolom jenis
            if (
                normalized === 'ya' ||
                normalized === 'tidak' ||
                normalized === '0' ||
                normalized === '-' ||
                normalized === 'null' ||
                normalized === 'undefined'
            ) {
                return;
            }

            // Kalau isinya angka saja, jangan dianggap jenis penyakit
            if (!isNaN(Number(text))) {
                return;
            }

            results.push(text);
        };

        if (Array.isArray(value)) {
            value.forEach(pushValue);
        } else {
            pushValue(value);
        }
    });

    results = results.filter(function (value, index, self) {
        return self.indexOf(value) === index;
    });

    if (results.length === 0) {
        return '-';
    }

    return results.join(', ');
}

function makeRtRw(rt, rw) {
    return String(rt || '-') + '/' + String(rw || '-');
}

function buildHealthRows() {
    const rows = [];

    if (!Array.isArray(allSubmissions)) {
        return rows;
    }

    allSubmissions.forEach(function (item) {
        const answers = item.answers || [];

        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '-';
        const noKK = getAnswer(answers, 'No.KK') || item.displayDescription || '-';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const alamat = getAnswer(answers, 'Alamat') || item.locationAddress || '-';

        const ibuHamil = getHealthNumberFromSubmission(item, answers, 'Ibu Hamil', 'hamil');
        const disabilitas = getHealthNumberFromSubmission(item, answers, 'Disabilitas', 'disabilitas');
        const sakitKronis = getHealthNumberFromSubmission(item, answers, 'Sakit Kronis', 'sakit_kronis');

        let jenisDisabilitas = '-';

        if (disabilitas > 0) {
            jenisDisabilitas = getHealthTextFromSubmission(answers, [
                'jenis disabilitas',
                'macam disabilitas',
                'tipe disabilitas',
                'disabilitas yang dialami',
                'keterangan disabilitas'
            ]);
        }

        let jenisSakitKronis = '-';

        if (sakitKronis > 0) {
            jenisSakitKronis = getHealthTextFromSubmission(answers, [
                'jenis penyakit kronis',
                'nama penyakit kronis',
                'riwayat penyakit kronis',
                'sakit kronis yang diderita',
                'keterangan sakit kronis'
            ]);
        }

        const balita = getNumberAnswer(answers, 'Jumlah balita');
        const lansia = getNumberAnswer(answers, 'Lansia');

        const pampersAnswer = getAnswer(answers, 'pampers') || '-';
        const posyanduAnswer = getAnswer(answers, 'Aktif dalam kegiatan posyandu') || '-';

        const isPampers = normalizeText(pampersAnswer).includes('ya');
        const isPosyandu = normalizeText(posyanduAnswer).includes('ya');

        const hasHealthData =
            ibuHamil > 0 ||
            disabilitas > 0 ||
            sakitKronis > 0 ||
            balita > 0 ||
            lansia > 0 ||
            isPampers ||
            isPosyandu;

        if (!hasHealthData) {
            return;
        }

        rows.push({
            id: item.id || item.localId || '',
            namaKK: namaKK,
            noKK: noKK,
            rt: rt,
            rw: rw,
            rtRw: makeRtRw(rt, rw),
            alamat: alamat,
            ibuHamil: ibuHamil,
            disabilitas: disabilitas,
            jenisDisabilitas: jenisDisabilitas,
            sakitKronis: sakitKronis,
            jenisSakitKronis: jenisSakitKronis,
            balita: balita,
            lansia: lansia,
            pampers: pampersAnswer,
            posyandu: posyanduAnswer,
            isPampers: isPampers,
            isPosyandu: isPosyandu,
            period: item.period || '',
            status: item.status || ''
        });
    });

    return rows;
}

function getFilteredHealthRows() {
    const categoryFilter = document.getElementById('healthCategoryFilter');
    const rtFilter = document.getElementById('healthRtFilter');
    const searchInput = document.getElementById('healthSearchInput');

    const selectedCategory = normalizeText(categoryFilter ? categoryFilter.value : 'semua');
    const selectedRt = normalizeText(rtFilter ? rtFilter.value : '');
    const search = normalizeText(searchInput ? searchInput.value : '');

    const rows = buildHealthRows();

    return rows.filter(function (row) {
        if (selectedRt && !normalizeText(row.rt).includes(selectedRt)) {
            return false;
        }

        if (selectedCategory !== 'semua') {
            if (selectedCategory === 'ibu_hamil' && row.ibuHamil <= 0) return false;
            if (selectedCategory === 'disabilitas' && row.disabilitas <= 0) return false;
            if (selectedCategory === 'sakit_kronis' && row.sakitKronis <= 0) return false;
            if (selectedCategory === 'balita' && row.balita <= 0) return false;
            if (selectedCategory === 'lansia' && row.lansia <= 0) return false;
            if (selectedCategory === 'pampers' && !row.isPampers) return false;
            if (selectedCategory === 'posyandu' && !row.isPosyandu) return false;
        }

        const combined = normalizeText(
            row.namaKK + ' ' +
            row.noKK + ' ' +
            row.rt + ' ' +
            row.rw + ' ' +
            row.alamat + ' ' +
            row.period + ' ' +
            row.status + ' ' +
            row.pampers + ' ' +
            row.posyandu + ' ' +
            row.jenisDisabilitas + ' ' +
            row.jenisSakitKronis
        );

        if (search && !combined.includes(search)) {
            return false;
        }

        return true;
    });
}

function renderHealthModalSummary(rows) {
    let totalIbuHamil = 0;
    let totalDisabilitas = 0;
    let totalSakitKronis = 0;
    let totalBalita = 0;
    let totalLansia = 0;
    let totalPampers = 0;

    rows.forEach(function (row) {
        totalIbuHamil += Number(row.ibuHamil || 0);
        totalDisabilitas += Number(row.disabilitas || 0);
        totalSakitKronis += Number(row.sakitKronis || 0);
        totalBalita += Number(row.balita || 0);
        totalLansia += Number(row.lansia || 0);

        if (row.isPampers) {
            totalPampers += 1;
        }
    });

    document.getElementById('healthModalIbuHamil').textContent = formatNumber(totalIbuHamil);
    document.getElementById('healthModalDisabilitas').textContent = formatNumber(totalDisabilitas);
    document.getElementById('healthModalSakitKronis').textContent = formatNumber(totalSakitKronis);
    document.getElementById('healthModalBalita').textContent = formatNumber(totalBalita);
    document.getElementById('healthModalLansia').textContent = formatNumber(totalLansia);
    document.getElementById('healthModalPampers').textContent = formatNumber(totalPampers);
}

function renderHealthTable() {
    const tableBody = document.getElementById('healthTable');
    const totalText = document.getElementById('healthTotalText');

    if (!tableBody) {
        return;
    }

    const rows = getFilteredHealthRows();

    renderHealthModalSummary(rows);

    if (totalText) {
        totalText.textContent = 'Total data kesehatan: ' + formatNumber(rows.length);
    }

    tableBody.innerHTML = '';

    if (rows.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="13" class="empty-text">Data kesehatan tidak ditemukan</td>
            </tr>
        `;
        return;
    }

    rows.forEach(function (row) {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${row.namaKK || '-'}</td>
            <td>${row.rt || '-'}</td>
            <td>${row.rw || '-'}</td>
            <td>${renderHealthNumberBadge(row.ibuHamil, 'pink')}</td>
            <td>${renderHealthNumberBadge(row.disabilitas, 'purple')}</td>
            <td>${row.jenisDisabilitas || '-'}</td>
            <td>${renderHealthNumberBadge(row.sakitKronis, 'orange')}</td>
            <td>${row.jenisSakitKronis || '-'}</td>
            <td>${renderHealthNumberBadge(row.balita, 'yellow')}</td>
            <td>${renderHealthNumberBadge(row.lansia, 'purple')}</td>
            <td>${renderHealthYesNoBadge(row.pampers)}</td>
            <td>${renderHealthYesNoBadge(row.posyandu)}</td>
            <td>
                <button class="action-btn" onclick="openDetailModal('${row.id}')">
                    Detail
                </button>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

function renderHealthNumberBadge(value, color) {
    const number = Number(value || 0);

    if (number <= 0) {
        return `<span class="badge badge-orange">0</span>`;
    }

    if (color === 'pink') {
        return `<span class="badge badge-pink">${number}</span>`;
    }

    if (color === 'purple') {
        return `<span class="badge badge-purple">${number}</span>`;
    }

    if (color === 'yellow') {
        return `<span class="badge badge-yellow">${number}</span>`;
    }

    return `<span class="badge badge-orange">${number}</span>`;
}

function renderHealthYesNoBadge(value) {
    const text = normalizeText(value);

    if (text.includes('ya')) {
        return `<span class="badge badge-green">Ya</span>`;
    }

    if (text.includes('tidak')) {
        return `<span class="badge badge-orange">Tidak</span>`;
    }

    return `<span class="badge badge-orange">-</span>`;
}

function downloadHealthReportCSV() {
    const rows = getFilteredHealthRows();

    if (!Array.isArray(rows) || rows.length === 0) {
        alert('Tidak ada data kesehatan untuk diunduh.');
        return;
    }

    const csvRows = [];

    const headers = [
        'Nama Kepala Keluarga',
        'No KK',
        'RT/RW',
        'Alamat',
        'Ibu Hamil',
        'Disabilitas',
        'Jenis Disabilitas',
        'Penyakit Kronis',
        'Jenis Penyakit Kronis',
        'Balita',
        'Lansia',
        'Pampers',
        'Aktif Posyandu',
        'Periode',
        'Status'
    ];

    csvRows.push(headers.map(escapeCSV).join(','));

    rows.forEach(function (row) {
        const values = [
            row.namaKK || '',
            row.noKK || '',
            row.rtRw || '',
            row.alamat || '',
            row.ibuHamil || 0,
            row.disabilitas || 0,
            row.jenisDisabilitas || '',
            row.sakitKronis || 0,
            row.jenisSakitKronis || '',
            row.balita || 0,
            row.lansia || 0,
            row.pampers || '',
            row.posyandu || '',
            row.period || '',
            row.status || ''
        ];

        csvRows.push(values.map(escapeCSV).join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');

    const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const periodInput = document.getElementById('periodFilter');
    const period = periodInput && periodInput.value ? periodInput.value : 'semua-periode';

    link.href = url;
    link.download = 'rekap_kesehatan_pendataan_desa_' + period + '.csv';
    link.click();

    URL.revokeObjectURL(url);
}

/* ===============================
   HOUSE MODAL
   Untuk menu Rekap Rumah
================================ */

function openHouseModal() {
    const modal = document.getElementById('houseModal');

    if (!modal) {
        return;
    }

    modal.classList.add('show');

    const conditionFilter = document.getElementById('houseConditionFilter');
    const locationFilter = document.getElementById('houseLocationFilter');
    const photoFilter = document.getElementById('housePhotoFilter');
    const rtFilter = document.getElementById('houseRtFilter');
    const searchInput = document.getElementById('houseSearchInput');

    if (conditionFilter) {
        conditionFilter.onchange = renderHouseTable;
    }

    if (locationFilter) {
        locationFilter.onchange = renderHouseTable;
    }

    if (photoFilter) {
        photoFilter.onchange = renderHouseTable;
    }

    if (rtFilter) {
        rtFilter.oninput = renderHouseTable;
    }

    if (searchInput) {
        searchInput.oninput = renderHouseTable;
        searchInput.focus();
    }

    renderHouseTable();
}

function closeHouseModal() {
    const modal = document.getElementById('houseModal');

    if (modal) {
        modal.classList.remove('show');
    }
}

function resetHouseFilter() {
    const conditionFilter = document.getElementById('houseConditionFilter');
    const locationFilter = document.getElementById('houseLocationFilter');
    const photoFilter = document.getElementById('housePhotoFilter');
    const rtFilter = document.getElementById('houseRtFilter');
    const searchInput = document.getElementById('houseSearchInput');

    if (conditionFilter) {
        conditionFilter.value = 'semua';
    }

    if (locationFilter) {
        locationFilter.value = 'semua';
    }

    if (photoFilter) {
        photoFilter.value = 'semua';
    }

    if (rtFilter) {
        rtFilter.value = '';
    }

    if (searchInput) {
        searchInput.value = '';
    }

    renderHouseTable();
}

function getHouseAnswer(answers, keywords) {
    let result = '';

    if (!Array.isArray(answers)) {
        return result;
    }

    answers.forEach(function (item) {
        const question = normalizeText(item.questionText || '');

        const isMatch = keywords.some(function (keyword) {
            return question.includes(normalizeText(keyword));
        });

        if (isMatch && !result) {
            result = item.answer;
        }
    });

    return result;
}

function hasHousePhoto(item) {
    if (!item) {
        return false;
    }

    if (item.imageUrl) {
        return true;
    }

    if (Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
        return true;
    }

    return false;
}

function hasHouseLocation(item) {
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);

    if (!lat || !lng) {
        return false;
    }

    return true;
}

function getHouseConditionCategory(statusRumah, kondisiRumah) {
    const combined = normalizeText(statusRumah + ' ' + kondisiRumah);

    if (
        combined.includes('tidak layak') ||
        combined.includes('tidak_layak') ||
        combined.includes('rusak berat') ||
        combined.includes('rusak') ||
        combined.includes('buruk')
    ) {
        return 'tidak_layak';
    }

    if (
        combined.includes('layak') ||
        combined.includes('baik') ||
        combined.includes('permanen')
    ) {
        return 'layak';
    }

    if (combined.includes('sedang')) {
        return 'sedang';
    }

    return 'belum_diisi';
}

function buildHouseRows() {
    const rows = [];

    if (!Array.isArray(allSubmissions)) {
        return rows;
    }

    allSubmissions.forEach(function (item) {
        const answers = item.answers || [];

        const namaKK = getAnswer(answers, 'Nama Kepala Keluarga') || item.displayTitle || '-';
        const noKK = getAnswer(answers, 'No.KK') || item.displayDescription || '-';
        const rt = item.rt || getAnswer(answers, 'RT') || '-';
        const rw = item.rw || getAnswer(answers, 'RW') || '-';
        const alamat = getAnswer(answers, 'Alamat') || item.locationAddress || '-';

        const statusRumah =
            getHouseAnswer(answers, [
                'status rumah',
                'status kepemilikan bangunan',
                'kepemilikan rumah',
                'rumah milik'
            ]) || '-';

        const kondisiRumah =
            getHouseAnswer(answers, [
                'kondisi rumah',
                'kelayakan rumah',
                'rumah layak',
                'status kelayakan rumah'
            ]) || '-';

        const sumberAir =
            getHouseAnswer(answers, [
                'sumber air',
                'air bersih',
                'sumber air bersih'
            ]) || '-';

        const jamban =
            getHouseAnswer(answers, [
                'jenis kloset',
                'kloset',
                'toilet',
                'wc',
                'kakus'
            ]) || '-';

        const listrik =
            getHouseAnswer(answers, [
                'listrik',
                'daya listrik',
                'sumber penerangan'
            ]) || '-';

        const fotoLengkap = hasHousePhoto(item);
        const lokasiLengkap = hasHouseLocation(item);

        const conditionCategory = getHouseConditionCategory(statusRumah, kondisiRumah);

        rows.push({
            id: item.id || item.localId || '',
            namaKK: namaKK,
            noKK: noKK,
            rt: rt,
            rw: rw,
            rtRw: makeRtRw(rt, rw),
            alamat: alamat,
            statusRumah: statusRumah,
            kondisiRumah: kondisiRumah,
            sumberAir: sumberAir,
            jamban: jamban,
            listrik: listrik,
            fotoLengkap: fotoLengkap,
            lokasiLengkap: lokasiLengkap,
            conditionCategory: conditionCategory,
            latitude: item.latitude || '',
            longitude: item.longitude || '',
            period: item.period || '',
            status: item.status || ''
        });
    });

    return rows;
}

function getFilteredHouseRows() {
    const conditionFilter = document.getElementById('houseConditionFilter');
    const locationFilter = document.getElementById('houseLocationFilter');
    const photoFilter = document.getElementById('housePhotoFilter');
    const rtFilter = document.getElementById('houseRtFilter');
    const searchInput = document.getElementById('houseSearchInput');

    const selectedCondition = normalizeText(conditionFilter ? conditionFilter.value : 'semua');
    const selectedLocation = normalizeText(locationFilter ? locationFilter.value : 'semua');
    const selectedPhoto = normalizeText(photoFilter ? photoFilter.value : 'semua');
    const selectedRt = normalizeText(rtFilter ? rtFilter.value : '');
    const search = normalizeText(searchInput ? searchInput.value : '');

    const rows = buildHouseRows();

    return rows.filter(function (row) {
        const rowCondition = normalizeText(
            row.kondisiRumah + ' ' +
            row.statusRumah + ' ' +
            row.conditionCategory
        );

        if (selectedRt && !normalizeText(row.rt).includes(selectedRt)) {
            return false;
        }

        if (selectedLocation === 'lengkap' && !row.lokasiLengkap) {
            return false;
        }

        if (selectedLocation === 'belum' && row.lokasiLengkap) {
            return false;
        }

        if (selectedPhoto === 'ada' && !row.fotoLengkap) {
            return false;
        }

        if (selectedPhoto === 'belum' && row.fotoLengkap) {
            return false;
        }

        if (selectedCondition !== 'semua') {
            if (selectedCondition === 'layak' && row.conditionCategory !== 'layak') {
                return false;
            }

            if (selectedCondition === 'tidak_layak' && row.conditionCategory !== 'tidak_layak') {
                return false;
            }

            if (
                selectedCondition !== 'layak' &&
                selectedCondition !== 'tidak_layak' &&
                !rowCondition.includes(selectedCondition)
            ) {
                return false;
            }
        }

        const combined = normalizeText(
            row.namaKK + ' ' +
            row.noKK + ' ' +
            row.rt + ' ' +
            row.rw + ' ' +
            row.alamat + ' ' +
            row.statusRumah + ' ' +
            row.kondisiRumah + ' ' +
            row.sumberAir + ' ' +
            row.jamban + ' ' +
            row.listrik + ' ' +
            row.period + ' ' +
            row.status
        );

        if (search && !combined.includes(search)) {
            return false;
        }

        return true;
    });
}

function renderHouseModalSummary(rows) {
    let totalRumah = rows.length;
    let totalLokasiLengkap = 0;
    let totalTanpaLokasi = 0;
    let totalAdaFoto = 0;

    rows.forEach(function (row) {
        if (row.lokasiLengkap) {
            totalLokasiLengkap++;
        } else {
            totalTanpaLokasi++;
        }

        if (row.fotoLengkap) {
            totalAdaFoto++;
        }
    });

    document.getElementById('houseModalTotal').textContent = formatNumber(totalRumah);
    document.getElementById('houseModalLokasiLengkap').textContent = formatNumber(totalLokasiLengkap);
    document.getElementById('houseModalTanpaLokasi').textContent = formatNumber(totalTanpaLokasi);
    document.getElementById('houseModalAdaFoto').textContent = formatNumber(totalAdaFoto);
}

function renderHouseTable() {
    const tableBody = document.getElementById('houseTable');
    const totalText = document.getElementById('houseTotalText');

    if (!tableBody) {
        return;
    }

    const rows = getFilteredHouseRows();

    renderHouseModalSummary(rows);

    if (totalText) {
        totalText.textContent = 'Total data rumah: ' + formatNumber(rows.length);
    }

    tableBody.innerHTML = '';

        if (rows.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-text">Data rumah tidak ditemukan</td>
            </tr>
        `;
        return;
    }

    rows.forEach(function (row) {
        const tr = document.createElement('tr');

        tr.innerHTML = `
        <td>${row.namaKK || '-'}</td>
        <td>${row.rt || '-'}</td>
        <td>${row.rw || '-'}</td>
        <td>${row.alamat || '-'}</td>
        <td>${renderHouseTextBadge(row.statusRumah)}</td>
        <td>${row.sumberAir || '-'}</td>
        <td>${row.jamban || '-'}</td>
        <td>${row.listrik || '-'}</td>
        <td>${renderHousePhotoBadge(row.fotoLengkap)}</td>
        <td>${renderHouseLocationBadge(row)}</td>
    `;

        tableBody.appendChild(tr);
    });
}

function renderHouseTextBadge(value) {
    const text = String(value || '-');

    if (text === '-') {
        return `<span class="badge badge-orange">-</span>`;
    }

    return `<span class="badge badge-green">${text}</span>`;
}

function renderHouseConditionBadge(value, category) {
    const text = String(value || '-');

    if (category === 'tidak_layak') {
        return `<span class="badge badge-pink">${text}</span>`;
    }

    if (category === 'layak') {
        return `<span class="badge badge-green">${text}</span>`;
    }

    if (normalizeText(text).includes('sedang')) {
        return `<span class="badge badge-yellow">${text}</span>`;
    }

    if (text === '-') {
        return `<span class="badge badge-orange">Belum Diisi</span>`;
    }

    return `<span class="badge badge-orange">${text}</span>`;
}

function renderHousePhotoBadge(isComplete) {
    if (isComplete) {
        return `<span class="badge badge-green">Ada</span>`;
    }

    return `<span class="badge badge-orange">Belum Ada</span>`;
}

function renderHouseLocationBadge(row) {
    if (row.lokasiLengkap) {
        return `
            <a href="https://www.google.com/maps?q=${row.latitude},${row.longitude}" target="_blank" class="action-btn">
                Maps
            </a>
        `;
    }

    return `<span class="badge badge-orange">Belum Ada</span>`;
}

function downloadHouseReportCSV() {
    const rows = getFilteredHouseRows();

    if (!Array.isArray(rows) || rows.length === 0) {
        alert('Tidak ada data rumah untuk diunduh.');
        return;
    }

    const headers = [
        'Nama Kepala Keluarga',
        'No KK',
        'RT/RW',
        'Alamat',
        'Status Rumah',
        'Kondisi Rumah',
        'Sumber Air',
        'Jamban',
        'Listrik',
        'Status Foto',
        'Status Lokasi',
        'Latitude',
        'Longitude',
        'Google Maps',
        'Periode',
        'Status Data'
    ];

    const csvRows = [];

    csvRows.push(headers.map(escapeCSV).join(','));

    rows.forEach(function (row) {
        const googleMaps = row.lokasiLengkap
            ? 'https://www.google.com/maps?q=' + row.latitude + ',' + row.longitude
            : '';

        const values = [
            row.namaKK || '',
            row.noKK || '',
            row.rtRw || '',
            row.alamat || '',
            row.statusRumah || '',
            row.kondisiRumah || '',
            row.sumberAir || '',
            row.jamban || '',
            row.listrik || '',
            row.fotoLengkap ? 'Ada Foto' : 'Belum Ada Foto',
            row.lokasiLengkap ? 'Lokasi Lengkap' : 'Belum Ada Lokasi',
            row.latitude || '',
            row.longitude || '',
            googleMaps,
            row.period || '',
            row.status || ''
        ];

        csvRows.push(values.map(escapeCSV).join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');

    const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const periodInput = document.getElementById('periodFilter');
    const period = periodInput && periodInput.value ? periodInput.value : 'semua-periode';

    link.href = url;
    link.download = 'rekap_rumah_pendataan_desa_' + period + '.csv';
    link.click();

    URL.revokeObjectURL(url);
}

/* ===============================
   SETTINGS MODAL
   Untuk menu Pengaturan
================================ */

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');

    if (!modal) {
        return;
    }

    modal.classList.add('show');
    renderSettingsModal();
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');

    if (modal) {
        modal.classList.remove('show');
    }
}

function renderSettingsModal() {
    const villageNameText = document.getElementById('settingsModalVillageName');
    const adminNameText = document.getElementById('settingsModalAdminName');
    const adminRoleText = document.getElementById('settingsModalAdminRole');
    const periodText = document.getElementById('settingsModalPeriod');
    const realtimeText = document.getElementById('settingsModalRealtime');
    const lastUpdatedText = document.getElementById('settingsModalLastUpdated');
    const previewText = document.getElementById('settingsModalPreview');

    const periodInput = document.getElementById('periodFilter');
    const realtimeStatus = document.getElementById('realtimeStatus');
    const lastUpdated = document.getElementById('lastUpdated');

    let villageName = '-';

    if (Array.isArray(allSubmissions) && allSubmissions.length > 0) {
        villageName = allSubmissions[0].villageName || '-';
    }

    if (villageNameText) {
        villageNameText.textContent = villageName;
    }

    if (adminNameText) {
        adminNameText.textContent = 'Admin Desa';
    }

    if (adminRoleText) {
        adminRoleText.textContent = 'Admin Desa';
    }

    if (periodText) {
        periodText.textContent = periodInput && periodInput.value ? periodInput.value : '-';
    }

    if (realtimeText) {
        realtimeText.textContent = realtimeStatus ? realtimeStatus.textContent : 'Terhubung';
    }

    if (lastUpdatedText) {
        lastUpdatedText.textContent = lastUpdated ? lastUpdated.textContent : '-';
    }

    if (previewText) {
        previewText.textContent = defaultRowLimit + ' data';
    }
}