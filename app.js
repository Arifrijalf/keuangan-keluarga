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
const LIST_ADMIN = [
    "arifrijalfadhilah@gmail.com", 
    // Tambahkan email admin lain
];

// 👇 TAMBAHKAN INI DI SINI 👇
const FAMILY_EMAILS = [
    "arifrijalfadhilah@gmail.com", // Admin wajib masuk sini juga
    "email.ayah@gmail.com",
    "email.ibu@gmail.com",
    "email.adik@gmail.com"
];

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); 
const provider = new firebase.auth.GoogleAuthProvider();

// Variabel Global
let currentUser = null; 
let isAdmin = false; 
let myChart = null;
let modeTab = 'keluarga'; 
let saldoAwalKeluarga = 0;
let saldoAwalPribadi = 0;

let filterBulan = new Date().getMonth();
let filterTahun = new Date().getFullYear();
let dataBudget = {}; 

// ==========================================
// 3. LOGIKA AUTH & STARTUP
// ==========================================
auth.onAuthStateChanged(user => {
    if (user) {
        
        // 👇 SISIPKAN KODE PENGECEKAN INI 👇
        // Cek apakah email ada di daftar keluarga?
        if (!FAMILY_EMAILS.includes(user.email)) {
            alert("Maaf, email Anda tidak terdaftar sebagai keluarga! Hubungi Admin.");
            auth.signOut(); // Tendang keluar user asing
            return; // Hentikan proses, jangan lanjut ke bawah
        }
        // 👆 ----------------------------- 👆

        currentUser = user;
        isAdmin = LIST_ADMIN.includes(user.email);
        
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('appScreen').classList.remove('d-none');
    }
});

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
// 4. LOGIKA TABUNGAN (FIXED ADMIN PERSONAL TRANSFER)
// ==========================================

function pantauTabungan() {
    let koleksi = db.collection('tabungan_goals');
    
    koleksi.onSnapshot(snapshot => {
        let html = '';
        let adaData = false;
        const container = document.getElementById('containerTabungan');
        const btnTambah = document.getElementById('btnTambahTabungan');

        if (modeTab === 'keluarga') {
            if(isAdmin) btnTambah.classList.remove('d-none');
            else btnTambah.classList.add('d-none');
        } else {
            btnTambah.classList.remove('d-none');
        }

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const id = doc.id;

            if (modeTab === 'keluarga') {
                if (data.type !== 'keluarga') return;
            } else {
                if (data.email_pemilik !== currentUser.email || data.type !== 'pribadi') return;
            }

            adaData = true;
            const persen = Math.min((data.terkumpul / data.target) * 100, 100);
            const actionClick = `onclick="bukaModalSetorTabungan('${id}', '${data.nama}')"`;

            html += `
                <div class="col-md-6">
                    <div class="card shadow-sm border-0 h-100" style="cursor: pointer;" ${actionClick}>
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="fw-bold mb-0 text-dark">${data.nama}</h6>
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

window.bukaModalSetorTabungan = (id, nama) => {
    document.getElementById('idTabunganSetor').value = id;
    document.getElementById('labelNamaTabungan').innerText = nama;
    document.getElementById('inputSetoran').value = ''; 
    
    const selectSumber = document.getElementById('pilihanSumber');
    if(selectSumber) selectSumber.value = 'pribadi';

    const divSumber = document.getElementById('divSumberDana');
    const grupTombolAdmin = document.getElementById('grupTombolAdmin');

    let isAuthorized = false;

    if (modeTab === 'keluarga') {
        if (isAdmin) {
            isAuthorized = true;
            if(divSumber) divSumber.classList.remove('d-none'); 
        } else {
            isAuthorized = false;
            if(divSumber) divSumber.classList.add('d-none');
        }
    } else {
        isAuthorized = true;
        if(divSumber) divSumber.classList.add('d-none'); 
    }

    if (isAuthorized) {
        grupTombolAdmin.classList.remove('d-none');
    } else {
        grupTombolAdmin.classList.add('d-none');
    }

    new bootstrap.Modal(document.getElementById('modalSetorTabungan')).show();
}

// 🛠️ FIX PENTING DI SINI
window.simpanSetoranTabungan = () => {
    const id = document.getElementById('idTabunganSetor').value;
    const namaTarget = document.getElementById('labelNamaTabungan').innerText;
    const jumlahSetor = parseInt(document.getElementById('inputSetoran').value);
    const selectSumber = document.getElementById('pilihanSumber');
    const sumber = selectSumber ? selectSumber.value : 'pribadi';

    if (!jumlahSetor || jumlahSetor <= 0) return alert("Nominal salah!");

    // Cek apakah ini Alokasi Kas (Hanya Admin di Tab Keluarga yang pilih 'kas_keluarga')
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
        // KASUS 1: Admin ambil uang Kas Keluarga
        dataTransaksi.kategori = 'Alokasi Tabungan'; 
        dataTransaksi.keterangan = `Alokasi Kas ke Target: ${namaTarget}`;
        // Tandai sebagai Transaksi Keluarga (biar saldo keluarga berkurang)
        dataTransaksi.is_family_trx = true; 
    } else {
        // KASUS 2: Setor Pakai Uang Pribadi (Admin/Member)
        dataTransaksi.kategori = 'Tabungan';
        dataTransaksi.keterangan = `Setor Pribadi ke: ${namaTarget}`;
        // 🛠️ FIX: Tandai sebagai PRIBADI (biar saldo keluarga TIDAK berkurang jika Admin yang setor)
        dataTransaksi.is_family_trx = false; 
    }

    const updateTarget = db.collection('tabungan_goals').doc(id).update({
        terkumpul: firebase.firestore.FieldValue.increment(jumlahSetor)
    });

    const catatPengeluaran = db.collection('transaksi').add(dataTransaksi);

    Promise.all([updateTarget, catatPengeluaran]).then(() => {
        if(isAmbilKas) alert("Alokasi Kas Keluarga Berhasil!");
        else alert("Setor Tabungan Berhasil!");
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
// 5. FITUR TRANSFER (SETOR KE KAS)
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
        is_family_trx: false // PRIBADI
    });

    // 2. Tambah Kas Keluarga
    const catatPemasukanKeluarga = db.collection('transaksi').add({
        tipe: 'pemasukan',
        kategori: 'Setoran Anggota',
        jumlah: jumlah,
        keterangan: `Dari ${currentUser.displayName}: ${catatan}`,
        tanggal: new Date().toLocaleDateString('id-ID'),
        waktu: firebase.firestore.FieldValue.serverTimestamp(),
        email_pencatat: LIST_ADMIN[0], 
        nama_pencatat: currentUser.displayName,
        is_family_trx: true // KELUARGA
    });

    Promise.all([catatPengeluaranUser, catatPemasukanKeluarga]).then(() => {
        alert("Uang berhasil dikirim ke Kas Keluarga!");
        location.reload();
    });
}

// ==========================================
// 6. LOGIKA BACA DATA (FIX SALDO)
// ==========================================

function bacaDataTransaksi() {
    db.collection('transaksi').orderBy('waktu', 'desc').onSnapshot(snapshot => {
        let html = '';
        let totalSaldoReal = modeTab === 'keluarga' ? saldoAwalKeluarga : saldoAwalPribadi;
        let statsPengeluaran = {}; 
        let dataDitemukan = false;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            const isAdminEntry = LIST_ADMIN.includes(data.email_pencatat);
            const isMyEntry = data.email_pencatat === currentUser.email;

            // --- FILTER TAMPILAN ---
            if (modeTab === 'keluarga') {
                if (!isAdminEntry && !isMyEntry) return; 
                // Jangan tampilkan transaksi PRIBADI milik Admin di list Keluarga
                if (isAdminEntry && data.is_family_trx === false) return;
            } else {
                if (!isMyEntry) return;
                // Jangan tampilkan transaksi KELUARGA di list Pribadi Admin
                if (data.is_family_trx === true && modeTab === 'pribadi') return;
            }

            // --- HITUNG SALDO REAL ---
            if (modeTab === 'keluarga') {
                if (isAdminEntry) {
                     // 🛠️ FIX UTAMA: Jika Admin melakukan transaksi PRIBADI (is_family_trx = false), 
                     // JANGAN dihitung sebagai pengurangan Saldo Keluarga.
                     if (data.is_family_trx === false) {
                         // Skip (Ini uang pribadi admin)
                     } else {
                         // Ini uang keluarga (atau tidak ada labelnya/transaksi lama)
                         if (data.tipe === 'pemasukan') totalSaldoReal += parseInt(data.jumlah);
                         else totalSaldoReal -= parseInt(data.jumlah);
                     }
                }
            } else {
                // Saldo Pribadi
                if (data.tipe === 'pemasukan') totalSaldoReal += parseInt(data.jumlah);
                else totalSaldoReal -= parseInt(data.jumlah);
            }

            // --- VISUALISASI ---
            let dateObj = data.waktu ? data.waktu.toDate() : new Date();
            if (dateObj.getMonth() === filterBulan && dateObj.getFullYear() === filterTahun) {
                
                dataDitemukan = true;

                // Sembunyikan 'Setoran Anggota' di list Anggota
                if (modeTab === 'keluarga' && !isAdmin && isAdminEntry && data.kategori === 'Setoran Anggota') {
                    return; 
                }

                if (data.tipe === 'pengeluaran') {
                    if (!statsPengeluaran[data.kategori]) statsPengeluaran[data.kategori] = 0;
                    statsPengeluaran[data.kategori] += parseInt(data.jumlah);
                }
                
                const warnaClass = data.tipe === 'pemasukan' ? 'border-hijau' : 'border-merah';
                const icon = data.tipe === 'pemasukan' ? '🟢' : '🔴';
                const tanggalStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                
                let tombolAksi = '';
                if (isAdmin || isMyEntry) {
                    tombolAksi = `<div class="d-flex gap-2"><button class="btn btn-sm btn-link text-warning p-0" onclick="bukaModalEdit('${id}')"><i class="bi bi-pencil-square"></i></button><button class="btn btn-sm btn-link text-danger p-0" onclick="hapusData('${id}')"><i class="bi bi-trash"></i></button></div>`;
                }

                html += `<li class="list-group-item d-flex justify-content-between align-items-center ${warnaClass}"><div><div class="fw-bold">${icon} ${data.kategori} <span class="badge bg-light text-dark border ms-1" style="font-size:0.6em">${data.nama_pencatat}</span></div><small class="text-muted" style="font-size:0.8em">${tanggalStr} - ${data.keterangan}</small></div><div class="text-end ms-2"><span class="fw-bold d-block mb-1">Rp ${parseInt(data.jumlah).toLocaleString('id-ID')}</span>${tombolAksi}</div></li>`;
            }
        });

        document.getElementById('daftarTransaksi').innerHTML = html || '<li class="list-group-item text-center text-muted fst-italic">Belum ada transaksi.</li>';
        document.getElementById('tampilanSaldo').innerText = `Rp ${totalSaldoReal.toLocaleString('id-ID')}`;
        renderChart(statsPengeluaran);
    });
}

function renderChart(dataPengeluaran) {
    const ctx = document.getElementById('myChart');
    if (myChart) myChart.destroy();
    const labels = Object.keys(dataPengeluaran);
    const dataValues = Object.values(dataPengeluaran);
    if (labels.length === 0) return; 
    myChart = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: dataValues, backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
}

// Fungsi Standar
window.simpanTabunganBaru = () => { const nama = document.getElementById('namaTabungan').value; const target = parseInt(document.getElementById('targetTabungan').value); const tipeTabungan = modeTab === 'keluarga' ? 'keluarga' : 'pribadi'; db.collection('tabungan_goals').add({ nama: nama, target: target, terkumpul: 0, type: tipeTabungan, email_pemilik: currentUser.email, dibuat_pada: firebase.firestore.FieldValue.serverTimestamp() }).then(() => location.reload()); }
window.hapusTabungan = () => { const id = document.getElementById('idTabunganSetor').value; if(confirm("Yakin hapus?")) db.collection('tabungan_goals').doc(id).delete().then(() => location.reload()); }
function pantauSaldoKeluarga() { db.collection('pengaturan').doc('keuangan_keluarga').onSnapshot(doc => { saldoAwalKeluarga = doc.exists ? (doc.data().saldo || 0) : 0; if(modeTab === 'keluarga') refreshTampilan(); }); }
function pantauSaldoPribadi() { db.collection('pengaturan').doc('saldo_' + currentUser.email).onSnapshot(doc => { saldoAwalPribadi = doc.exists ? (doc.data().saldo || 0) : 0; if(modeTab === 'pribadi') refreshTampilan(); }); }
function pantauBudget() { let docId = modeTab === 'keluarga' ? 'budget_keluarga' : 'budget_' + currentUser.email; db.collection('pengaturan').doc(docId).onSnapshot(doc => { dataBudget = doc.exists ? doc.data() : {}; }); }
function updateTombolEdit() { const btnSaldo = document.getElementById('btnEditSaldo'); const btnBudget = document.getElementById('btnAturBudget'); document.getElementById('infoSaldoAwal').innerText = `(Saldo Awal: Rp ${(modeTab === 'keluarga' ? saldoAwalKeluarga : saldoAwalPribadi).toLocaleString('id-ID')})`; if (modeTab === 'keluarga' && !isAdmin) { btnSaldo.classList.add('d-none'); btnBudget.classList.add('d-none'); } else { btnSaldo.classList.remove('d-none'); btnBudget.classList.remove('d-none'); } }
window.bukaModalEdit = (id) => { db.collection('transaksi').doc(id).get().then((doc) => { if (doc.exists) { const data = doc.data(); document.getElementById('editId').value = id; document.getElementById('editTipe').value = data.tipe; document.getElementById('editKategori').value = data.kategori; document.getElementById('editJumlah').value = data.jumlah; document.getElementById('editKeterangan').value = data.keterangan; new bootstrap.Modal(document.getElementById('modalEditTransaksi')).show(); } }); }
window.updateTransaksi = () => { const id = document.getElementById('editId').value; db.collection('transaksi').doc(id).update({ tipe: document.getElementById('editTipe').value, kategori: document.getElementById('editKategori').value, jumlah: parseInt(document.getElementById('editJumlah').value), keterangan: document.getElementById('editKeterangan').value, }).then(() => location.reload()); }
window.hapusData = (id) => { if(confirm("Hapus?")) db.collection('transaksi').doc(id).delete(); }
window.bukaModalSaldo = () => { const nilai = modeTab === 'keluarga' ? saldoAwalKeluarga : saldoAwalPribadi; document.getElementById('inputSaldoAwal').value = nilai; new bootstrap.Modal(document.getElementById('modalSaldoAwal')).show(); }
window.simpanSaldoAwal = () => { const nilai = parseInt(document.getElementById('inputSaldoAwal').value); let docTarget = modeTab === 'keluarga' ? 'keuangan_keluarga' : 'saldo_' + currentUser.email; db.collection('pengaturan').doc(docTarget).set({ saldo: nilai }).then(() => location.reload()); }
window.bukaModalBudget = () => { document.getElementById('budgetMakan').value = dataBudget['Makan'] || ''; document.getElementById('budgetJajan').value = dataBudget['Jajan'] || ''; document.getElementById('budgetTransport').value = dataBudget['Transport'] || ''; document.getElementById('budgetBelanja').value = dataBudget['Belanja'] || ''; document.getElementById('budgetTagihan').value = dataBudget['Tagihan'] || ''; new bootstrap.Modal(document.getElementById('modalAturBudget')).show(); }
window.simpanBudget = () => { const budgetBaru = { Makan: parseInt(document.getElementById('budgetMakan').value) || 0, Jajan: parseInt(document.getElementById('budgetJajan').value) || 0, Transport: parseInt(document.getElementById('budgetTransport').value) || 0, Belanja: parseInt(document.getElementById('budgetBelanja').value) || 0, Tagihan: parseInt(document.getElementById('budgetTagihan').value) || 0 }; let docId = modeTab === 'keluarga' ? 'budget_keluarga' : 'budget_' + currentUser.email; db.collection('pengaturan').doc(docId).set(budgetBaru).then(() => location.reload()); }
document.getElementById('formTransaksi').addEventListener('submit', (e) => { e.preventDefault(); db.collection('transaksi').add({ tipe: document.getElementById('tipe').value, kategori: document.getElementById('kategori').value, jumlah: parseInt(document.getElementById('jumlah').value), keterangan: document.getElementById('keterangan').value, tanggal: new Date().toLocaleDateString('id-ID'), waktu: firebase.firestore.FieldValue.serverTimestamp(), email_pencatat: currentUser.email, nama_pencatat: currentUser.displayName, }).then(() => document.getElementById('formTransaksi').reset()); });
function loginGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut(); }