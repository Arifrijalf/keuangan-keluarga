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

// ==========================================
// VARIABEL GLOBAL
// ==========================================
let currentUser = null; 
let isAdmin = false; 
let myChart = null;
let modeTab = 'keluarga'; 
let saldoAwalKeluarga = 0;
let saldoAwalPribadi = 0;

let filterBulan = new Date().getMonth();
let filterTahun = new Date().getFullYear();
let dataBudget = {}; 
let currentPengeluaran = {}; 

// ==========================================
// LOGIKA AUTH & TEMA (DARK MODE)
// ==========================================

// Cek simpanan tema di memori browser
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    enableDarkMode(true);
}

auth.onAuthStateChanged(user => {
    if (user) {
        // 🔒 SECURITY CHECK: Menggunakan variabel FAMILY_EMAILS yang ada di atas
        if (typeof FAMILY_EMAILS !== 'undefined' && !FAMILY_EMAILS.includes(user.email)) {
            alert("Maaf, email Anda tidak terdaftar sebagai keluarga! Hubungi Admin.");
            auth.signOut(); 
            return; 
        }

        currentUser = user;
        // Cek Admin menggunakan variabel LIST_ADMIN yang ada di atas
        isAdmin = (typeof LIST_ADMIN !== 'undefined') && LIST_ADMIN.includes(user.email);
        
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('appScreen').classList.remove('d-none');
        document.getElementById('fotoUser').src = user.photoURL; 
        document.getElementById('welcomeText').innerText = `Halo, ${user.displayName}!`;

        // Set Filter Default ke Bulan Ini
        document.getElementById('filterBulan').value = filterBulan;
        document.getElementById('filterTahun').value = filterTahun;

        // Mulai Pantau Data
        pantauSaldoKeluarga();
        pantauSaldoPribadi();
        pantauBudget();
        refreshTampilan(); 
    } else {
        document.getElementById('loginScreen').classList.remove('d-none');
        document.getElementById('appScreen').classList.add('d-none');
    }
});

function toggleDarkMode() {
    const isDark = document.body.classList.contains('dark-mode');
    enableDarkMode(!isDark);
}

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
    
    // Update warna teks di Chart agar kontras
    if (myChart) {
        myChart.options.plugins.legend.labels.color = isDark ? '#e0e0e0' : '#666';
        myChart.update();
    }
}

// ==========================================
// LOGIKA NAVIGASI TAB
// ==========================================

window.gantiTab = (mode) => {
    modeTab = mode;
    const btnKeluarga = document.getElementById('tabKeluarga');
    const btnPribadi = document.getElementById('tabPribadi');
    const areaTransfer = document.getElementById('areaTransfer');

    if(mode === 'keluarga'){
        btnKeluarga.classList.add('active');
        btnPribadi.classList.remove('active');
        document.getElementById('judulSaldo').innerText = "Sisa Saldo Keluarga";
        areaTransfer.classList.add('d-none'); 
    } else {
        btnKeluarga.classList.remove('active');
        btnPribadi.classList.add('active');
        document.getElementById('judulSaldo').innerText = "Sisa Saldo Pribadi";
        areaTransfer.classList.remove('d-none');
    }
    pantauBudget(); 
    refreshTampilan();
}

function refreshTampilan() {
    filterBulan = parseInt(document.getElementById('filterBulan').value);
    filterTahun = parseInt(document.getElementById('filterTahun').value);
    bacaDataTransaksi(); 
    updateTombolEdit();
    pantauTabungan(); 
}

// ==========================================
// LOGIKA TABUNGAN (TARGET & ALOKASI)
// ==========================================

function pantauTabungan() {
    let koleksi = db.collection('tabungan_goals');
    
    koleksi.onSnapshot(snapshot => {
        let html = '';
        let adaData = false;
        const container = document.getElementById('containerTabungan');
        const btnTambah = document.getElementById('btnTambahTabungan');

        // Tombol Tambah hanya muncul untuk Admin (jika di tab Keluarga)
        if (modeTab === 'keluarga') {
            if(isAdmin) btnTambah.classList.remove('d-none');
            else btnTambah.classList.add('d-none');
        } else {
            btnTambah.classList.remove('d-none');
        }

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const id = doc.id;

            // Filter Tabungan Keluarga vs Pribadi
            if (modeTab === 'keluarga') {
                if (data.type !== 'keluarga') return;
            } else {
                if (data.email_pemilik !== currentUser.email || data.type !== 'pribadi') return;
            }

            adaData = true;
            const persen = Math.min((data.terkumpul / data.target) * 100, 100);
            
            // Render Kartu (Tanpa 'text-dark' agar aman di Dark Mode)
            html += `
                <div class="col-md-6">
                    <div class="card shadow-sm border-0 h-100" style="cursor: pointer;" onclick="bukaModalSetorTabungan('${id}', '${data.nama}')">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="fw-bold mb-0">${data.nama}</h6> 
                                <span class="badge bg-success rounded-pill">${Math.round(persen)}%</span>
                            </div>
                            <div class="progress mb-2" style="height: 10px;">
                                <div class="progress-bar bg-success progress-bar-striped" role="progressbar" style="width: ${persen}%"></div>
                            </div>
                            <div class="d-flex justify-content-between small text-muted">
                                <span>Terkumpul: <b>Rp ${parseInt(data.terkumpul).toLocaleString('id-ID')}</b></span>
                                <span>Target: Rp ${parseInt(data.target).toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        if (!adaData) {
            container.innerHTML = `<div class="col-12 text-center text-muted small fst-italic">Belum ada target.</div>`;
        } else {
            container.innerHTML = html;
        }
    });
}

// Modal Handlers Tabungan
window.bukaModalTambahTabungan = () => {
    document.getElementById('namaTabungan').value = '';
    document.getElementById('targetTabungan').value = '';
    new bootstrap.Modal(document.getElementById('modalTambahTabungan')).show();
}

window.bukaModalSetorTabungan = (id, nama) => {
    document.getElementById('idTabunganSetor').value = id;
    document.getElementById('labelNamaTabungan').innerText = nama;
    document.getElementById('inputSetoran').value = ''; 
    
    const divSumber = document.getElementById('divSumberDana');
    const grupTombolAdmin = document.getElementById('grupTombolAdmin');
    const selectSumber = document.getElementById('pilihanSumber');
    
    // Default select
    if(selectSumber) selectSumber.value = 'pribadi';

    // Logika Akses Sumber Dana
    let isAuthorized = false;
    if (modeTab === 'keluarga') {
        if (isAdmin) {
            isAuthorized = true;
            divSumber.classList.remove('d-none'); // Admin boleh pilih sumber kas
        } else {
            divSumber.classList.add('d-none');
        }
    } else {
        isAuthorized = true; // Tab pribadi selalu authorized
        divSumber.classList.add('d-none'); // Tab pribadi otomatis sumber pribadi
    }

    // Tampilkan tombol Hapus/Reset jika authorized
    if (isAuthorized) grupTombolAdmin.classList.remove('d-none');
    else grupTombolAdmin.classList.add('d-none');

    new bootstrap.Modal(document.getElementById('modalSetorTabungan')).show();
}

window.simpanSetoranTabungan = () => {
    const id = document.getElementById('idTabunganSetor').value;
    const namaTarget = document.getElementById('labelNamaTabungan').innerText;
    const jumlahSetor = parseInt(document.getElementById('inputSetoran').value);
    const selectSumber = document.getElementById('pilihanSumber');
    const sumber = selectSumber ? selectSumber.value : 'pribadi';

    if (!jumlahSetor || jumlahSetor <= 0) return alert("Nominal salah!");

    // Cek apakah mengambil dari Kas Keluarga?
    const isAmbilKas = (sumber === 'kas_keluarga' && isAdmin && modeTab === 'keluarga');

    let dataTransaksi = {
        tipe: 'pengeluaran',
        jumlah: jumlahSetor,
        tanggal: new Date().toLocaleDateString('id-ID'),
        waktu: firebase.firestore.FieldValue.serverTimestamp(),
        email_pencatat: currentUser.email, 
        nama_pencatat: currentUser.displayName
    };

    if (isAmbilKas) {
        // Alokasi Kas (Kurangi Saldo Keluarga)
        dataTransaksi.kategori = 'Alokasi Tabungan'; 
        dataTransaksi.keterangan = `Alokasi Kas ke Target: ${namaTarget}`;
        dataTransaksi.is_family_trx = true; 
    } else {
        // Setor Pribadi (Kurangi Saldo Pribadi)
        dataTransaksi.kategori = 'Tabungan';
        dataTransaksi.keterangan = `Setor Pribadi ke: ${namaTarget}`;
        dataTransaksi.is_family_trx = false; 
    }

    const updateTarget = db.collection('tabungan_goals').doc(id).update({
        terkumpul: firebase.firestore.FieldValue.increment(jumlahSetor)
    });

    const catatPengeluaran = db.collection('transaksi').add(dataTransaksi);

    Promise.all([updateTarget, catatPengeluaran]).then(() => {
        alert(isAmbilKas ? "Alokasi Kas Berhasil!" : "Setor Tabungan Berhasil!");
        location.reload();
    });
}

window.resetTabungan = () => {
    const id = document.getElementById('idTabunganSetor').value;
    if(confirm("Yakin reset saldo target ini jadi 0?")) {
        db.collection('tabungan_goals').doc(id).update({ terkumpul: 0 }).then(() => { alert("Berhasil direset!"); location.reload(); });
    }
}

// ==========================================
// FITUR TRANSFER (SETOR KE KAS) & BUDGET
// ==========================================

window.bukaModalSetorKas = () => {
    document.getElementById('jumlahSetorKas').value = '';
    document.getElementById('ketSetorKas').value = '';
    new bootstrap.Modal(document.getElementById('modalSetorKas')).show();
}

window.simpanSetorKas = () => {
    const jumlah = parseInt(document.getElementById('jumlahSetorKas').value);
    const catatan = document.getElementById('ketSetorKas').value || "Setoran Anggota";

    if (!jumlah || jumlah <= 0) return alert("Nominal salah!");

    // 1. Kurangi Dompet Pribadi
    const catatPengeluaranUser = db.collection('transaksi').add({
        tipe: 'pengeluaran',
        kategori: 'Transfer',
        jumlah: jumlah,
        keterangan: `Kirim ke Kas Keluarga: ${catatan}`,
        tanggal: new Date().toLocaleDateString('id-ID'),
        waktu: firebase.firestore.FieldValue.serverTimestamp(),
        email_pencatat: currentUser.email,
        nama_pencatat: currentUser.displayName,
        is_family_trx: false 
    });

    // 2. Tambah Kas Keluarga (Masuk ke Admin Utama)
    // Menggunakan LIST_ADMIN[0] (asumsi variabel ini ada di atas)
    const adminEmail = (typeof LIST_ADMIN !== 'undefined' && LIST_ADMIN.length > 0) ? LIST_ADMIN[0] : currentUser.email;

    const catatPemasukanKeluarga = db.collection('transaksi').add({
        tipe: 'pemasukan',
        kategori: 'Setoran Anggota',
        jumlah: jumlah,
        keterangan: `Dari ${currentUser.displayName}: ${catatan}`,
        tanggal: new Date().toLocaleDateString('id-ID'),
        waktu: firebase.firestore.FieldValue.serverTimestamp(),
        email_pencatat: adminEmail, 
        nama_pencatat: currentUser.displayName,
        is_family_trx: true 
    });

    Promise.all([catatPengeluaranUser, catatPemasukanKeluarga]).then(() => {
        alert("Uang berhasil dikirim ke Kas Keluarga!");
        location.reload();
    });
}

// LOGIKA BUDGET
function pantauBudget() {
    let docId = modeTab === 'keluarga' ? 'budget_keluarga' : 'budget_' + currentUser.email;
    db.collection('pengaturan').doc(docId).onSnapshot(doc => {
        dataBudget = doc.exists ? doc.data() : {};
        // Render ulang budget bar setiap kali data berubah atau ada transaksi baru
        renderBudgetProgress(currentPengeluaran);
    });
}

function renderBudgetProgress(pengeluaranBulanIni) {
    const container = document.getElementById('containerBudget');
    let htmlBudget = '';
    let adaBudget = false;
    const listKategori = ['Makan', 'Jajan', 'Transport', 'Belanja', 'Tagihan'];

    listKategori.forEach(kat => {
        const target = dataBudget[kat] || 0; 
        if (target > 0) {
            adaBudget = true;
            const terpakai = pengeluaranBulanIni[kat] || 0;
            const persen = Math.min((terpakai / target) * 100, 100); 
            
            let warnaBar = 'bg-success';
            if (persen > 75) warnaBar = 'bg-warning';
            if (persen > 90) warnaBar = 'bg-danger';

            htmlBudget += `
                <div class="mb-3">
                    <div class="d-flex justify-content-between small mb-1">
                        <span class="fw-bold">${kat}</span>
                        <span class="text-muted">${terpakai.toLocaleString('id-ID')} / ${target.toLocaleString('id-ID')}</span>
                    </div>
                    <div class="progress rounded-pill bg-light border" role="progressbar" style="height: 12px">
                        <div class="progress-bar ${warnaBar} rounded-pill" style="width: ${persen}%"></div>
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = adaBudget ? htmlBudget : `<p class="text-center small text-muted fst-italic py-3">Belum ada data anggaran.</p>`;
}

window.bukaModalBudget = () => {
    document.getElementById('budgetMakan').value = dataBudget['Makan'] || '';
    document.getElementById('budgetJajan').value = dataBudget['Jajan'] || '';
    document.getElementById('budgetTransport').value = dataBudget['Transport'] || '';
    document.getElementById('budgetBelanja').value = dataBudget['Belanja'] || '';
    document.getElementById('budgetTagihan').value = dataBudget['Tagihan'] || '';

    // Tombol Reset hanya untuk Admin (jika di tab Keluarga)
    const btnReset = document.getElementById('btnResetBudget');
    if (modeTab === 'keluarga' && !isAdmin) btnReset.classList.add('d-none');
    else btnReset.classList.remove('d-none');

    new bootstrap.Modal(document.getElementById('modalAturBudget')).show();
}

window.simpanBudget = () => {
    // 🔒 Security: Anggota tidak boleh ubah budget keluarga
    if (modeTab === 'keluarga' && !isAdmin) return alert("Akses Ditolak: Hanya Admin yang boleh mengatur anggaran keluarga!");

    const budgetBaru = { 
        Makan: parseInt(document.getElementById('budgetMakan').value) || 0, 
        Jajan: parseInt(document.getElementById('budgetJajan').value) || 0, 
        Transport: parseInt(document.getElementById('budgetTransport').value) || 0, 
        Belanja: parseInt(document.getElementById('budgetBelanja').value) || 0, 
        Tagihan: parseInt(document.getElementById('budgetTagihan').value) || 0 
    }; 
    
    let docId = modeTab === 'keluarga' ? 'budget_keluarga' : 'budget_' + currentUser.email; 
    db.collection('pengaturan').doc(docId).set(budgetBaru).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalAturBudget')).hide();
        location.reload();
    });
}

window.resetBudget = () => {
    if (modeTab === 'keluarga' && !isAdmin) return alert("Hanya Admin yang boleh mereset!");
    
    if(confirm("Hapus semua batasan?")) {
        const budgetKosong = { Makan: 0, Jajan: 0, Transport: 0, Belanja: 0, Tagihan: 0 };
        let docId = modeTab === 'keluarga' ? 'budget_keluarga' : 'budget_' + currentUser.email;
        db.collection('pengaturan').doc(docId).set(budgetKosong).then(() => location.reload());
    }
}

// ==========================================
// BACA DATA (TRANSAKSI, SALDO, CHART)
// ==========================================

function bacaDataTransaksi() {
    db.collection('transaksi').orderBy('waktu', 'desc').onSnapshot(snapshot => {
        let html = '';
        let totalSaldoReal = modeTab === 'keluarga' ? saldoAwalKeluarga : saldoAwalPribadi;
        let statsPengeluaran = {}; 
        
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            
            // Cek apakah variabel LIST_ADMIN terdefinisi
            const listAdmin = (typeof LIST_ADMIN !== 'undefined') ? LIST_ADMIN : [];
            const isAdminEntry = listAdmin.includes(data.email_pencatat);
            const isMyEntry = data.email_pencatat === currentUser.email;

            // --- FILTER TAB KELUARGA/PRIBADI ---
            if (modeTab === 'keluarga') {
                if (!isAdminEntry && !isMyEntry) return; 
                // Sembunyikan transaksi pribadi Admin saat di tab Keluarga
                if (isAdminEntry && data.is_family_trx === false) return;
            } else {
                if (!isMyEntry) return;
                // Sembunyikan transaksi keluarga saat di tab Pribadi
                if (data.is_family_trx === true && modeTab === 'pribadi') return;
            }

            // --- HITUNG SALDO REAL ---
            if (modeTab === 'keluarga') {
                if (isAdminEntry) {
                     if (data.is_family_trx !== false) { // Hanya hitung jika transaksi keluarga
                         if (data.tipe === 'pemasukan') totalSaldoReal += parseInt(data.jumlah);
                         else totalSaldoReal -= parseInt(data.jumlah);
                     }
                }
            } else {
                if (data.tipe === 'pemasukan') totalSaldoReal += parseInt(data.jumlah);
                else totalSaldoReal -= parseInt(data.jumlah);
            }

            // --- VISUALISASI RIWAYAT ---
            let dateObj = data.waktu ? data.waktu.toDate() : new Date();
            // Filter Bulan & Tahun
            if (dateObj.getMonth() === filterBulan && dateObj.getFullYear() === filterTahun) {
                
                // Sembunyikan "Setoran Anggota" di list Anggota (Keluarga) biar ga bingung
                if (modeTab === 'keluarga' && !isAdmin && isAdminEntry && data.kategori === 'Setoran Anggota') return; 

                // Hitung Statistik untuk Grafik
                if (data.tipe === 'pengeluaran') {
                    if (!statsPengeluaran[data.kategori]) statsPengeluaran[data.kategori] = 0;
                    statsPengeluaran[data.kategori] += parseInt(data.jumlah);
                }
                
                const warnaClass = data.tipe === 'pemasukan' ? 'border-success border-start border-4' : 'border-danger border-start border-4';
                const icon = data.tipe === 'pemasukan' ? 'bi-arrow-down-circle-fill text-success' : 'bi-arrow-up-circle-fill text-danger';
                
                let tombolAksi = '';
                if (isAdmin || isMyEntry) {
                    tombolAksi = `<div class="ms-2"><button class="btn btn-sm text-warning p-0 me-2" onclick="bukaModalEdit('${id}')"><i class="bi bi-pencil-square"></i></button><button class="btn btn-sm text-danger p-0" onclick="hapusData('${id}')"><i class="bi bi-trash"></i></button></div>`;
                }

                html += `
                    <li class="list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm rounded ${warnaClass}">
                        <div class="d-flex align-items-center">
                            <i class="bi ${icon} fs-3 me-3"></i>
                            <div>
                                <div class="fw-bold">${data.kategori}</div>
                                <div class="small text-muted">${dateObj.toLocaleDateString('id-ID')} • ${data.keterangan}</div>
                                <div class="badge bg-light text-secondary border mt-1" style="font-size:0.7em">${data.nama_pencatat}</div>
                            </div>
                        </div>
                        <div class="text-end">
                            <span class="fw-bold d-block ${data.tipe === 'pemasukan' ? 'text-success' : 'text-danger'}">Rp ${parseInt(data.jumlah).toLocaleString('id-ID')}</span>
                            ${tombolAksi}
                        </div>
                    </li>
                `;
            }
        });

        // Simpan data pengeluaran ke global (untuk budget)
        currentPengeluaran = statsPengeluaran;

        document.getElementById('daftarTransaksi').innerHTML = html || '<p class="text-center text-muted fst-italic mt-3">Belum ada transaksi bulan ini.</p>';
        document.getElementById('tampilanSaldo').innerText = `Rp ${totalSaldoReal.toLocaleString('id-ID')}`;
        
        renderChart(statsPengeluaran);
        renderBudgetProgress(statsPengeluaran);
    });
}

function renderChart(dataPengeluaran) {
    const ctx = document.getElementById('myChart');
    if (myChart) myChart.destroy();
    
    const labels = Object.keys(dataPengeluaran);
    const dataValues = Object.values(dataPengeluaran);
    
    // Cek Dark Mode untuk warna teks grafik awal
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e0e0e0' : '#666';

    if (labels.length === 0) return; 
    
    myChart = new Chart(ctx, { 
        type: 'doughnut', 
        data: { 
            labels: labels, 
            datasets: [{ 
                data: dataValues, 
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'], 
                borderWidth: 0,
                hoverOffset: 10
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { 
                    position: 'bottom',
                    labels: {
                        color: textColor, // Warna teks dinamis
                        font: { family: "'Poppins', sans-serif", size: 12 },
                        padding: 20
                    }
                } 
            },
            layout: { padding: 10 }
        } 
    });
}

// ==========================================
// FUNGSI CRUD & HELPER LAINNYA
// ==========================================

window.simpanTabunganBaru = () => { const nama = document.getElementById('namaTabungan').value; const target = parseInt(document.getElementById('targetTabungan').value); const tipeTabungan = modeTab === 'keluarga' ? 'keluarga' : 'pribadi'; db.collection('tabungan_goals').add({ nama: nama, target: target, terkumpul: 0, type: tipeTabungan, email_pemilik: currentUser.email, dibuat_pada: firebase.firestore.FieldValue.serverTimestamp() }).then(() => location.reload()); }
window.hapusTabungan = () => { const id = document.getElementById('idTabunganSetor').value; if(confirm("Yakin hapus?")) db.collection('tabungan_goals').doc(id).delete().then(() => location.reload()); }
function pantauSaldoKeluarga() { db.collection('pengaturan').doc('keuangan_keluarga').onSnapshot(doc => { saldoAwalKeluarga = doc.exists ? (doc.data().saldo || 0) : 0; if(modeTab === 'keluarga') refreshTampilan(); }); }
function pantauSaldoPribadi() { db.collection('pengaturan').doc('saldo_' + currentUser.email).onSnapshot(doc => { saldoAwalPribadi = doc.exists ? (doc.data().saldo || 0) : 0; if(modeTab === 'pribadi') refreshTampilan(); }); }
function updateTombolEdit() { const btnSaldo = document.getElementById('btnEditSaldo'); const btnBudget = document.getElementById('btnAturBudget'); document.getElementById('infoSaldoAwal').innerText = `(Saldo Awal: Rp ${(modeTab === 'keluarga' ? saldoAwalKeluarga : saldoAwalPribadi).toLocaleString('id-ID')})`; if (modeTab === 'keluarga' && !isAdmin) { btnSaldo.classList.add('d-none'); btnBudget.classList.add('d-none'); } else { btnSaldo.classList.remove('d-none'); btnBudget.classList.remove('d-none'); } }
window.bukaModalEdit = (id) => { db.collection('transaksi').doc(id).get().then((doc) => { if (doc.exists) { const data = doc.data(); document.getElementById('editId').value = id; document.getElementById('editTipe').value = data.tipe; document.getElementById('editKategori').value = data.kategori; document.getElementById('editJumlah').value = data.jumlah; document.getElementById('editKeterangan').value = data.keterangan; new bootstrap.Modal(document.getElementById('modalEditTransaksi')).show(); } }); }
window.updateTransaksi = () => { const id = document.getElementById('editId').value; db.collection('transaksi').doc(id).update({ tipe: document.getElementById('editTipe').value, kategori: document.getElementById('editKategori').value, jumlah: parseInt(document.getElementById('editJumlah').value), keterangan: document.getElementById('editKeterangan').value, }).then(() => location.reload()); }
window.hapusData = (id) => { if(confirm("Hapus?")) db.collection('transaksi').doc(id).delete(); }
window.bukaModalSaldo = () => { const nilai = modeTab === 'keluarga' ? saldoAwalKeluarga : saldoAwalPribadi; document.getElementById('inputSaldoAwal').value = nilai; new bootstrap.Modal(document.getElementById('modalSaldoAwal')).show(); }
window.simpanSaldoAwal = () => { const nilai = parseInt(document.getElementById('inputSaldoAwal').value); let docTarget = modeTab === 'keluarga' ? 'keuangan_keluarga' : 'saldo_' + currentUser.email; db.collection('pengaturan').doc(docTarget).set({ saldo: nilai }).then(() => location.reload()); }

// Listener Form Transaksi Utama
document.getElementById('formTransaksi').addEventListener('submit', (e) => { e.preventDefault(); db.collection('transaksi').add({ tipe: document.getElementById('tipe').value, kategori: document.getElementById('kategori').value, jumlah: parseInt(document.getElementById('jumlah').value), keterangan: document.getElementById('keterangan').value, tanggal: new Date().toLocaleDateString('id-ID'), waktu: firebase.firestore.FieldValue.serverTimestamp(), email_pencatat: currentUser.email, nama_pencatat: currentUser.displayName, }).then(() => document.getElementById('formTransaksi').reset()); });

function loginGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut(); }