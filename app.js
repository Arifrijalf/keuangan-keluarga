const firebaseConfig = {
  apiKey: "AIzaSyBxChORtQoRO66kOmhESsepnywDLII6K-4",
  authDomain: "keuangankeluarga-ca833.firebaseapp.com",
  projectId: "keuangankeluarga-ca833",
  storageBucket: "keuangankeluarga-ca833.firebasestorage.app",
  messagingSenderId: "489829945579",
  appId: "1:489829945579:web:6d65b761844bc1d827aeae"
};
// ==========================================
// 2. SETTING & INISIALISASI
// ==========================================

// DAFTAR ADMIN (Bisa Edit/Hapus Data Keluarga) 
const LIST_ADMIN = [
    "arifrijalfadhilah@gmail.com", 
    "jasarfa1@gmail.com"
];

// DAFTAR KELUARGA YANG DIIZINKAN LOGIN (Keamanan)
const FAMILY_EMAILS = [
    "arifrijalfadhilah@gmail.com", // Admin wajib masuk sini juga
    "ahiwjw18@gmail.com",
    "jasarfa1@gmail.com",
    "mamanyanazief@gmail.com",
    "aakuntest2007@gmail.com"
    // Tambahkan email keluarga lainnya
];

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); 
const provider = new firebase.auth.GoogleAuthProvider();

// ===============================================
// 2. VARIABEL GLOBAL
// ===============================================
let currentUser = null; 
let isAdmin = false; 
let myChart = null;
let myLineChart = null;
let modeTab = 'keluarga'; 
let saldoAwalKeluarga = 0;
let saldoAwalPribadi = 0;
let globalSaldoSaatIni = 0;

let filterBulan = new Date().getMonth();
let filterTahun = new Date().getFullYear();
let dataBudget = {}; 
let currentPengeluaran = {}; 

// --- AUTH & TEMA ---
if (localStorage.getItem('theme') === 'dark') enableDarkMode(true);

auth.onAuthStateChanged(user => {
    if (user) {
        if (typeof FAMILY_EMAILS !== 'undefined' && !FAMILY_EMAILS.includes(user.email)) {
            alert("Email tidak terdaftar!"); auth.signOut(); return; 
        }
        currentUser = user;
        isAdmin = (typeof LIST_ADMIN !== 'undefined') && LIST_ADMIN.includes(user.email);
        
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('appScreen').classList.remove('d-none');
        document.getElementById('fotoUser').src = user.photoURL; 
        document.getElementById('welcomeText').innerText = `Halo, ${user.displayName}!`;
        document.getElementById('filterBulan').value = filterBulan;
        document.getElementById('filterTahun').value = filterTahun;

        pantauSaldoKeluarga(); pantauSaldoPribadi(); pantauBudget(); refreshTampilan(); 
    } else {
        document.getElementById('loginScreen').classList.remove('d-none');
        document.getElementById('appScreen').classList.add('d-none');
    }
});

function toggleDarkMode() { enableDarkMode(!document.body.classList.contains('dark-mode')); }
function enableDarkMode(isDark) {
    const body = document.body;
    const icon = document.getElementById('iconTheme');
    if (isDark) {
        body.classList.add('dark-mode');
        icon.classList.replace('bi-moon-stars-fill', 'bi-sun-fill');
        icon.classList.replace('text-primary', 'text-warning');
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.remove('dark-mode');
        icon.classList.replace('bi-sun-fill', 'bi-moon-stars-fill');
        icon.classList.replace('text-warning', 'text-primary');
        localStorage.setItem('theme', 'light');
    }
    const color = isDark ? '#e0e0e0' : '#666';
    if(myChart) { myChart.options.plugins.legend.labels.color = color; myChart.update(); }
    if(myLineChart) { myLineChart.options.scales.x.ticks.color = color; myLineChart.options.scales.y.ticks.color = color; myLineChart.update(); }
}

window.gantiTab = (mode) => {
    modeTab = mode;
    const btnK = document.getElementById('tabKeluarga');
    const btnP = document.getElementById('tabPribadi');
    const trf = document.getElementById('areaTransfer');

    if(mode === 'keluarga'){
        btnK.classList.add('active'); btnP.classList.remove('active');
        document.getElementById('judulSaldo').innerText = "Sisa Saldo Keluarga";
        trf.classList.add('d-none'); 
    } else {
        btnK.classList.remove('active'); btnP.classList.add('active');
        document.getElementById('judulSaldo').innerText = "Sisa Saldo Pribadi";
        trf.classList.remove('d-none');
    }
    pantauBudget(); refreshTampilan();
}

function refreshTampilan() {
    filterBulan = parseInt(document.getElementById('filterBulan').value);
    filterTahun = parseInt(document.getElementById('filterTahun').value);
    bacaDataTransaksi(); updateTombolEdit(); pantauTabungan(); pantauLangganan();
}

// --- DATA TRANSAKSI ---
function bacaDataTransaksi() {
    db.collection('transaksi').orderBy('waktu', 'asc').onSnapshot(snapshot => {
        let html = '';
        let totalSaldo = modeTab === 'keluarga' ? saldoAwalKeluarga : saldoAwalPribadi;
        let stats = {}; 
        let daily = {};
        let allDocs = [];
        snapshot.docs.forEach(doc => allDocs.push({ id: doc.id, ...doc.data() }));

        allDocs.forEach(data => {
            const listAdmin = (typeof LIST_ADMIN !== 'undefined') ? LIST_ADMIN : [];
            const isAdminEntry = listAdmin.includes(data.email_pencatat);
            const isMyEntry = data.email_pencatat === currentUser.email;

            if (modeTab === 'keluarga') {
                if (!isAdminEntry && !isMyEntry) return; 
                if (isAdminEntry && data.is_family_trx === false) return;
            } else {
                if (!isMyEntry) return;
                if (data.is_family_trx === true && modeTab === 'pribadi') return;
            }

            let val = parseInt(data.jumlah);
            if (data.tipe === 'pemasukan') totalSaldo += val; else totalSaldo -= val;

            let dateObj = data.waktu ? data.waktu.toDate() : new Date();
            if (dateObj.getMonth() === filterBulan && dateObj.getFullYear() === filterTahun) {
                if (modeTab === 'keluarga' && !isAdmin && isAdminEntry && data.kategori === 'Setoran Anggota') return; 

                let tgl = dateObj.getDate();
                if (!daily[tgl]) daily[tgl] = { pemasukan: 0, pengeluaran: 0 };
                if (data.tipe === 'pemasukan') daily[tgl].pemasukan += val; else daily[tgl].pengeluaran += val;

                if (data.tipe === 'pengeluaran') {
                    if (!stats[data.kategori]) stats[data.kategori] = 0;
                    stats[data.kategori] += val;
                }
            }
        });

        globalSaldoSaatIni = totalSaldo;
        document.getElementById('tampilanSaldo').innerText = `Rp ${totalSaldo.toLocaleString('id-ID')}`;

        let docsRev = allDocs.slice().reverse();
        docsRev.forEach(data => {
            // (Logika filter sama dengan atas)
            const listAdmin = (typeof LIST_ADMIN !== 'undefined') ? LIST_ADMIN : [];
            const isAdminEntry = listAdmin.includes(data.email_pencatat);
            const isMyEntry = data.email_pencatat === currentUser.email;
            if (modeTab === 'keluarga') {
                if (!isAdminEntry && !isMyEntry) return; 
                if (isAdminEntry && data.is_family_trx === false) return;
            } else {
                if (!isMyEntry) return;
                if (data.is_family_trx === true && modeTab === 'pribadi') return;
            }
            let dateObj = data.waktu ? data.waktu.toDate() : new Date();
            if (dateObj.getMonth() === filterBulan && dateObj.getFullYear() === filterTahun) {
                if (modeTab === 'keluarga' && !isAdmin && isAdminEntry && data.kategori === 'Setoran Anggota') return;
                const cls = data.tipe === 'pemasukan' ? 'border-success border-start border-4' : 'border-danger border-start border-4';
                const ico = data.tipe === 'pemasukan' ? 'bi-arrow-down-circle-fill text-success' : 'bi-arrow-up-circle-fill text-danger';
                let btn = '';
                if (isAdmin || isMyEntry) {
                    btn = `<div class="ms-2"><button class="btn btn-sm text-warning p-0 me-2" onclick="bukaModalEdit('${data.id}')"><i class="bi bi-pencil-square"></i></button><button class="btn btn-sm text-danger p-0" onclick="hapusData('${data.id}')"><i class="bi bi-trash"></i></button></div>`;
                }
                html += `<li class="list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm rounded ${cls}"><div class="d-flex align-items-center"><i class="bi ${ico} fs-3 me-3"></i><div><div class="fw-bold">${data.kategori}</div><div class="small text-muted">${dateObj.toLocaleDateString('id-ID')} • ${data.keterangan}</div><div class="badge bg-light text-secondary border mt-1" style="font-size:0.7em">${data.nama_pencatat}</div></div></div><div class="text-end"><span class="fw-bold d-block ${data.tipe === 'pemasukan' ? 'text-success' : 'text-danger'}">Rp ${parseInt(data.jumlah).toLocaleString('id-ID')}</span>${btn}</div></li>`;
            }
        });

        document.getElementById('daftarTransaksi').innerHTML = html || '<p class="text-center text-muted mt-3">Belum ada transaksi.</p>';
        renderChart(stats); renderLineChart(daily); renderBudgetProgress(stats);
    });
}

// --- CHART & LINE ---
function renderChart(stats) {
    const ctx = document.getElementById('myChart'); if(myChart) myChart.destroy();
    if(Object.keys(stats).length === 0) return;
    myChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: document.body.classList.contains('dark-mode')?'#e0e0e0':'#666' } } } } });
}
// Grafik Garis (Tren Harian) - Updated: Support Dual Lines
function renderLineChart(dataHarian) {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;
    if (myLineChart) myLineChart.destroy();

    const labels = Object.keys(dataHarian).sort((a,b) => a - b);
    const tipeView = document.getElementById('tipeGrafik').value; // 'semua', 'pemasukan', 'pengeluaran'
    
    // Siapkan Data Array
    const dataMasuk = labels.map(tgl => dataHarian[tgl].pemasukan);
    const dataKeluar = labels.map(tgl => dataHarian[tgl].pengeluaran);

    // Konfigurasi Warna
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e0e0e0' : '#666';
    
    // Siapkan Datasets (Bisa 1 atau 2 garis)
    let datasets = [];

    // Dataset Pemasukan (Hijau)
    const datasetMasuk = {
        label: 'Pemasukan',
        data: dataMasuk,
        borderColor: '#2ecc71', // Hijau
        backgroundColor: 'rgba(46, 204, 113, 0.1)', // Hijau Transparan
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#2ecc71'
    };

    // Dataset Pengeluaran (Merah)
    const datasetKeluar = {
        label: 'Pengeluaran',
        data: dataKeluar,
        borderColor: '#e74c3c', // Merah
        backgroundColor: 'rgba(231, 76, 60, 0.1)', // Merah Transparan
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#e74c3c'
    };

    // LOGIKA PEMILIHAN
    if (tipeView === 'semua') {
        datasets.push(datasetMasuk);  // Masukkan Garis Hijau
        datasets.push(datasetKeluar); // Masukkan Garis Merah
    } else if (tipeView === 'pemasukan') {
        datasets.push(datasetMasuk);
    } else {
        datasets.push(datasetKeluar);
    }

    myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(t => `Tgl ${t}`),
            datasets: datasets // Masukkan dataset yg sudah dipilih di atas
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: (tipeView === 'semua'), // Munculkan label "Masuk/Keluar" cuma kalau pilih 'Semua'
                    labels: { color: textColor }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                x: { 
                    ticks: { color: textColor, font: { size: 10 } }, 
                    grid: { display: false } 
                },
                y: { 
                    ticks: { color: textColor, callback: v => (v/1000)+'k' }, 
                    grid: { borderDash: [5,5], color: isDark ? '#333' : '#eee' } 
                }
            }
        }
    });
}
// --- LANGGANAN (TAGIHAN RUTIN) ---
function pantauLangganan() {
    db.collection('langganan').onSnapshot(snapshot => {
        let html = '';
        const now = new Date();
        const periode = `${now.getMonth()}-${now.getFullYear()}`;
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            if (modeTab === 'keluarga' && data.type !== 'keluarga') return;
            if (modeTab !== 'keluarga' && (data.email_pemilik !== currentUser.email || data.type !== 'pribadi')) return;

            let isLunas = data.riwayat_bayar && data.riwayat_bayar.includes(periode);
            let badge = isLunas ? `<span class="badge bg-success-subtle text-success border border-success rounded-pill">Lunas</span>` : (now.getDate() > data.tgl_jatuh_tempo ? `<span class="badge bg-danger-subtle text-danger border rounded-pill">Telat!</span>` : `<span class="badge bg-warning-subtle text-warning-emphasis border rounded-pill">Tgl ${data.tgl_jatuh_tempo}</span>`);
            let btn = isLunas ? `<button class="btn btn-sm btn-light border" disabled>Lunas</button>` : `<button onclick="bayarLangganan('${id}', '${data.nama}', ${data.biaya})" class="btn btn-sm btn-primary rounded-pill shadow-sm">Bayar</button>`;

            html += `<div class="col-md-6 col-12"><div class="card shadow-sm border-0 h-100"><div class="card-body d-flex justify-content-between align-items-center p-3"><div><div class="d-flex align-items-center gap-2 mb-1"><h6 class="fw-bold mb-0">${data.nama}</h6>${badge}</div><div class="small text-muted">Rp ${parseInt(data.biaya).toLocaleString()} / bln</div></div><div class="d-flex align-items-center gap-2">${btn}<button onclick="hapusLangganan('${id}')" class="btn btn-link text-danger p-0"><i class="bi bi-x-circle"></i></button></div></div></div></div>`;
        });
        document.getElementById('containerLangganan').innerHTML = html || `<div class="col-12 text-center text-muted small py-3">Belum ada tagihan rutin.</div>`;
    });
}

window.bukaModalTambahLangganan = () => {
    const select = document.getElementById('tglLangganan');
    
    // 🔥 PERBAIKAN: Cek apakah dropdown kosong? Jika iya, isi otomatis!
    if (select.options.length === 0) {
        select.innerHTML = ''; // Bersihkan dulu biar aman
        for(let i=1; i<=31; i++){
            // Tambahkan opsi Tanggal 1 s.d 31
            const option = document.createElement('option');
            option.value = i;
            option.text = `Tanggal ${i}`;
            select.appendChild(option);
        }
    }

    // Reset form input
    document.getElementById('namaLangganan').value = '';
    document.getElementById('biayaLangganan').value = '';
    
    // Tampilkan Modal
    new bootstrap.Modal(document.getElementById('modalTambahLangganan')).show();
}

// 🔥 FUNGSI UTAMA YANG TADI ERROR
window.simpanLanggananBaru = () => {
    const nama = document.getElementById('namaLangganan').value;
    const biaya = parseInt(document.getElementById('biayaLangganan').value);
    const tgl = parseInt(document.getElementById('tglLangganan').value);
    
    // Debugging (Cek Console kalau error lagi)
    console.log("Menyimpan...", nama, biaya, tgl);

    if(!nama || !biaya) return alert("Data kurang lengkap!");

    db.collection('langganan').add({
        nama: nama, biaya: biaya, tgl_jatuh_tempo: tgl,
        type: modeTab==='keluarga'?'keluarga':'pribadi', email_pemilik: currentUser.email, riwayat_bayar: []
    }).then(() => {
        // Tutup modal
        bootstrap.Modal.getInstance(document.getElementById('modalTambahLangganan')).hide();
    }).catch(err => {
        alert("Gagal menyimpan: " + err.message);
    });
}

window.bayarLangganan = (id, nama, biaya) => {
    if(biaya > globalSaldoSaatIni) return alert("❌ Saldo tidak cukup!");
    if(!confirm(`Bayar tagihan ${nama}?`)) return;
    const now = new Date();
    const periode = `${now.getMonth()}-${now.getFullYear()}`;
    Promise.all([
        db.collection('transaksi').add({
            tipe: 'pengeluaran', kategori: 'Tagihan', jumlah: biaya, keterangan: `Langganan: ${nama}`,
            tanggal: now.toLocaleDateString('id-ID'), waktu: firebase.firestore.FieldValue.serverTimestamp(),
            email_pencatat: currentUser.email, nama_pencatat: currentUser.displayName, is_family_trx: (modeTab==='keluarga')
        }),
        db.collection('langganan').doc(id).update({ riwayat_bayar: firebase.firestore.FieldValue.arrayUnion(periode) })
    ]).then(() => alert("Lunas!"));
}
window.hapusLangganan = (id) => { if(confirm("Hapus?")) db.collection('langganan').doc(id).delete(); }

// --- TABUNGAN & LAINNYA ---
function pantauTabungan() {
    db.collection('tabungan_goals').onSnapshot(snapshot => {
        let html = '';
        const btnTambah = document.getElementById('btnTambahTabungan');
        if (modeTab === 'keluarga') { if(isAdmin) btnTambah.classList.remove('d-none'); else btnTambah.classList.add('d-none'); } else { btnTambah.classList.remove('d-none'); }

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (modeTab === 'keluarga' && data.type !== 'keluarga') return;
            if (modeTab !== 'keluarga' && (data.email_pemilik !== currentUser.email || data.type !== 'pribadi')) return;
            const pct = Math.min((data.terkumpul / data.target) * 100, 100);
            html += `<div class="col-md-6"><div class="card shadow-sm border-0 h-100" style="cursor: pointer;" onclick="bukaModalSetorTabungan('${doc.id}')"><div class="card-body"><div class="d-flex justify-content-between align-items-center mb-2"><h6 class="fw-bold mb-0">${data.nama}</h6><span class="badge bg-success rounded-pill">${Math.round(pct)}%</span></div><div class="progress mb-2" style="height: 10px;"><div class="progress-bar bg-success" style="width: ${pct}%"></div></div><div class="d-flex justify-content-between small text-muted"><span>Terkumpul: <b>Rp ${parseInt(data.terkumpul).toLocaleString()}</b></span><span>Target: Rp ${parseInt(data.target).toLocaleString()}</span></div></div></div></div>`;
        });
        document.getElementById('containerTabungan').innerHTML = html || `<div class="col-12 text-center text-muted small">Belum ada target.</div>`;
    });
}
window.cekTenorManual = () => { const p = document.getElementById('pilihanTenor').value; const i = document.getElementById('inputTenorManual'); if(p==='manual'){i.classList.remove('d-none');i.focus();}else{i.classList.add('d-none');} }
window.bukaModalTambahTabungan = () => { document.getElementById('namaTabungan').value=''; document.getElementById('targetTabungan').value=''; document.getElementById('pilihanTenor').value='12'; document.getElementById('inputTenorManual').classList.add('d-none'); new bootstrap.Modal(document.getElementById('modalTambahTabungan')).show(); }
window.simpanTabunganBaru = () => {
    const nama = document.getElementById('namaTabungan').value;
    const target = parseInt(document.getElementById('targetTabungan').value);
    let tenor = document.getElementById('pilihanTenor').value;
    if(tenor==='manual') tenor = parseInt(document.getElementById('inputTenorManual').value); else tenor = parseInt(tenor);
    if(!nama || !target || !tenor) return alert("Data tidak valid!");
    db.collection('tabungan_goals').add({ nama: nama, target: target, tenor: tenor, terkumpul: 0, type: modeTab==='keluarga'?'keluarga':'pribadi', email_pemilik: currentUser.email, dibuat_pada: firebase.firestore.FieldValue.serverTimestamp() }).then(() => location.reload());
}
window.bukaModalSetorTabungan = (id) => {
    db.collection('tabungan_goals').doc(id).get().then(doc => {
        if(!doc.exists) return; const data = doc.data();
        document.getElementById('idTabunganSetor').value = id; document.getElementById('labelNamaTabungan').innerText = data.nama;
        document.getElementById('infoTarget').innerText = `Target: Rp ${parseInt(data.target).toLocaleString()}`; document.getElementById('infoSisa').innerText = `Sisa: Rp ${(data.target-data.terkumpul).toLocaleString()}`; document.getElementById('barProgressTabungan').style.width = `${Math.min((data.terkumpul/data.target)*100,100)}%`;
        const list = document.getElementById('listCicilan'); list.innerHTML = '';
        const cicilan = Math.ceil(data.target / (data.tenor||1)); let temp = data.terkumpul;
        for(let i=1; i<=(data.tenor||1); i++){
            let lunas = false; if(temp>=cicilan){lunas=true;temp-=cicilan;}else if(temp>0){temp=0;}
            let div = document.createElement('div');
            if(lunas) div.innerHTML = `<div class="p-3 bg-success-subtle border border-success rounded d-flex justify-content-between align-items-center mb-2"><div><span class="fw-bold text-success">Bulan ke-${i}</span><div class="small">Rp ${cicilan.toLocaleString()}</div></div><span class="badge bg-success">Lunas</span></div>`;
            else div.innerHTML = `<div class="p-3 bg-light border rounded d-flex justify-content-between align-items-center mb-2"><div><span class="fw-bold text-muted">Bulan ke-${i}</span><div class="small">Rp ${cicilan.toLocaleString()}</div></div><button onclick="prosesBayarCicilan('${id}', ${cicilan}, 'Bulan ke-${i}')" class="btn btn-sm btn-outline-primary rounded-pill">Bayar</button></div>`;
            list.appendChild(div);
        }
        new bootstrap.Modal(document.getElementById('modalSetorTabungan')).show();
    });
}
window.prosesBayarCicilan = (id, nom, ket) => {
    if(nom > globalSaldoSaatIni) return alert("❌ Saldo kurang!");
    const trx = { tipe: 'pengeluaran', jumlah: nom, tanggal: new Date().toLocaleDateString('id-ID'), waktu: firebase.firestore.FieldValue.serverTimestamp(), email_pencatat: currentUser.email, nama_pencatat: currentUser.displayName, kategori: 'Tabungan', keterangan: ket, is_family_trx: (modeTab==='keluarga') };
    Promise.all([db.collection('tabungan_goals').doc(id).update({terkumpul: firebase.firestore.FieldValue.increment(nom)}), db.collection('transaksi').add(trx)]).then(()=>{ bootstrap.Modal.getInstance(document.getElementById('modalSetorTabungan')).hide(); setTimeout(()=>bukaModalSetorTabungan(id),500); });
}
window.simpanSetoranManual = () => { const id = document.getElementById('idTabunganSetor').value; const val = parseInt(document.getElementById('inputSetoranManual').value); if(val>0) prosesBayarCicilan(id, val, "Setoran Manual"); }
window.hapusTabungan = () => { if(confirm("Hapus?")) db.collection('tabungan_goals').doc(document.getElementById('idTabunganSetor').value).delete().then(()=>location.reload()); }
window.resetTabungan = () => { if(confirm("Reset?")) db.collection('tabungan_goals').doc(document.getElementById('idTabunganSetor').value).update({terkumpul:0}).then(()=>location.reload()); }

// --- Helper UI ---
function pantauSaldoKeluarga() { db.collection('pengaturan').doc('keuangan_keluarga').onSnapshot(doc => { saldoAwalKeluarga = doc.exists ? (doc.data().saldo || 0) : 0; if(modeTab === 'keluarga') refreshTampilan(); }); }
function pantauSaldoPribadi() { db.collection('pengaturan').doc('saldo_' + currentUser.email).onSnapshot(doc => { saldoAwalPribadi = doc.exists ? (doc.data().saldo || 0) : 0; if(modeTab === 'pribadi') refreshTampilan(); }); }
function updateTombolEdit() {
    const info = document.getElementById('infoSaldoAwal');
    info.innerText = `(Saldo Awal: Rp ${(modeTab==='keluarga'?saldoAwalKeluarga:saldoAwalPribadi).toLocaleString('id-ID')})`;
    const display = (modeTab === 'keluarga' && !isAdmin) ? 'none' : 'inline-block';
    document.getElementById('btnEditSaldo').style.display = display;
    document.getElementById('btnAturBudget').style.display = display;
}
window.bukaModalSaldo = () => { document.getElementById('inputSaldoAwal').value = modeTab==='keluarga'?saldoAwalKeluarga:saldoAwalPribadi; new bootstrap.Modal(document.getElementById('modalSaldoAwal')).show(); }
window.simpanSaldoAwal = () => { let val = parseInt(document.getElementById('inputSaldoAwal').value); let doc = modeTab==='keluarga'?'keuangan_keluarga':'saldo_'+currentUser.email; db.collection('pengaturan').doc(doc).set({saldo:val}).then(()=>location.reload()); }
window.bukaModalSetorKas = () => { document.getElementById('jumlahSetorKas').value=''; document.getElementById('ketSetorKas').value=''; new bootstrap.Modal(document.getElementById('modalSetorKas')).show(); }
window.simpanSetorKas = () => {
    const jum = parseInt(document.getElementById('jumlahSetorKas').value);
    if(jum > globalSaldoSaatIni) return alert("❌ Saldo Kurang!");
    Promise.all([
        db.collection('transaksi').add({tipe:'pengeluaran',kategori:'Transfer',jumlah:jum,keterangan:'Ke Kas',tanggal:new Date().toLocaleDateString('id-ID'),waktu:firebase.firestore.FieldValue.serverTimestamp(),email_pencatat:currentUser.email,nama_pencatat:currentUser.displayName,is_family_trx:false}),
        db.collection('transaksi').add({tipe:'pemasukan',kategori:'Setoran Anggota',jumlah:jum,keterangan:`Dari ${currentUser.displayName}`,tanggal:new Date().toLocaleDateString('id-ID'),waktu:firebase.firestore.FieldValue.serverTimestamp(),email_pencatat:((typeof LIST_ADMIN !== 'undefined' && LIST_ADMIN.length > 0) ? LIST_ADMIN[0] : currentUser.email),nama_pencatat:currentUser.displayName,is_family_trx:true})
    ]).then(()=>location.reload());
}
window.bukaModalBudget = () => { ['Makan','Jajan','Transport','Belanja','Tagihan'].forEach(k => document.getElementById('budget'+k).value = dataBudget[k]||''); new bootstrap.Modal(document.getElementById('modalAturBudget')).show(); }
window.simpanBudget = () => { let d={}; ['Makan','Jajan','Transport','Belanja','Tagihan'].forEach(k=>d[k]=parseInt(document.getElementById('budget'+k).value)||0); db.collection('pengaturan').doc(modeTab==='keluarga'?'budget_keluarga':'budget_'+currentUser.email).set(d).then(()=>{bootstrap.Modal.getInstance(document.getElementById('modalAturBudget')).hide();location.reload();}); }
window.resetBudget = () => { if(confirm("Reset?")) db.collection('pengaturan').doc(modeTab==='keluarga'?'budget_keluarga':'budget_'+currentUser.email).set({Makan:0,Jajan:0,Transport:0,Belanja:0,Tagihan:0}).then(()=>location.reload()); }
function pantauBudget() { db.collection('pengaturan').doc(modeTab==='keluarga'?'budget_keluarga':'budget_'+currentUser.email).onSnapshot(doc=>{dataBudget=doc.exists?doc.data():{};renderBudgetProgress(currentPengeluaran);}); }
function renderBudgetProgress(exp) {
    let h=''; ['Makan','Jajan','Transport','Belanja','Tagihan'].forEach(k=>{ if((dataBudget[k]||0)>0){ let p=Math.min(((exp[k]||0)/dataBudget[k])*100,100); h+=`<div class="mb-3"><div class="d-flex justify-content-between small mb-1"><span class="fw-bold">${k}</span><span class="text-muted">${(exp[k]||0).toLocaleString()} / ${dataBudget[k].toLocaleString()}</span></div><div class="progress rounded-pill bg-light border" style="height:12px"><div class="progress-bar ${p>90?'bg-danger':(p>75?'bg-warning':'bg-success')} rounded-pill" style="width:${p}%"></div></div></div>`; } }); document.getElementById('containerBudget').innerHTML=h||'<p class="text-center small text-muted">Belum ada anggaran.</p>';
}

// Form Transaksi
document.getElementById('formTransaksi').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = document.getElementById('tipe').value; const j = parseInt(document.getElementById('jumlah').value);
    if(t==='pengeluaran' && j>globalSaldoSaatIni) return alert("❌ Saldo Kurang!");
    db.collection('transaksi').add({tipe:t,kategori:document.getElementById('kategori').value,jumlah:j,keterangan:document.getElementById('keterangan').value,tanggal:new Date().toLocaleDateString('id-ID'),waktu:firebase.firestore.FieldValue.serverTimestamp(),email_pencatat:currentUser.email,nama_pencatat:currentUser.displayName}).then(()=>document.getElementById('formTransaksi').reset());
});
function loginGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut(); }