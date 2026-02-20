// ==========================================
// 1. CONFIG FIREBASE & INISIALISASI
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBxChORtQoRO66kOmhESsepnywDLII6K-4",
  authDomain: "keuangankeluarga-ca833.firebaseapp.com",
  projectId: "keuangankeluarga-ca833",
  storageBucket: "keuangankeluarga-ca833.firebasestorage.app",
  messagingSenderId: "489829945579",
  appId: "1:489829945579:web:6d65b761844bc1d827aeae"
};

// DAFTAR ADMIN (Bisa Edit/Hapus Data Keluarga) 
const LIST_ADMIN = [
    "arifrijalfadhilah@gmail.com", 
    "jasarfa1@gmail.com"
];

// DAFTAR KELUARGA YANG DIIZINKAN LOGIN
const FAMILY_EMAILS = [
    "arifrijalfadhilah@gmail.com",
    "ahiwjw18@gmail.com",
    "jasarfa1@gmail.com",
    "mamanyanazief@gmail.com",
    "aakuntest2007@gmail.com",
    "tasha.arizka22@gmail.com"
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
let filterDompet = 'semua'; 
let dataBudget = {}; 
let currentPengeluaran = {}; 

// 🔥 VARIABEL BARU UNTUK EXPORT 🔥
let rawDataTransaksi = []; // Menampung SEMUA data mentah (tanpa filter bulan)

// [FITUR] LIST KATEGORI & DOMPET
const KATEGORI_LIST = {
    'pengeluaran': ['Makan', 'Jajan', 'Transport', 'Belanja', 'Tagihan', 'Kesehatan', 'Sedekah', 'Lainnya'],
    'pemasukan': ['Gaji', 'Bonus', 'Hadiah', 'Penjualan', 'Investasi', 'Lainnya']
};

const DOMPET_LIST = ['Tunai', 'BCA', 'Mandiri', 'BRI', 'DANA', 'GoPay', 'ShopeePay', 'OVO', 'Lainnya'];

// ===============================================
// 3. AUTH & SETUP AWAL
// ===============================================

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

        initDropdownDompet(); 
        updateKategori();
        
        document.getElementById('tipe').addEventListener('change', updateKategori);
        const editTipeSelect = document.getElementById('editTipe');
        if(editTipeSelect) {
            editTipeSelect.addEventListener('change', () => updatePilihanKategori('editTipe', 'editKategori'));
        }

        pantauSaldoKeluarga(); pantauSaldoPribadi(); pantauBudget(); refreshTampilan(); 
    } else {
        document.getElementById('loginScreen').classList.remove('d-none');
        document.getElementById('appScreen').classList.add('d-none');
    }
});

function initDropdownDompet() {
    const targets = ['filterDompet', 'inputDompet', 'editDompet'];
    targets.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = '';
        if(id === 'filterDompet') {
            const optAll = document.createElement('option');
            optAll.value = 'semua';
            optAll.text = '💼 Semua Sumber';
            el.appendChild(optAll);
        }
        DOMPET_LIST.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.text = (d === 'Tunai' ? '💵 ' : (['BCA','Mandiri','BRI'].includes(d) ? '🏦 ' : '📱 ')) + d;
            el.appendChild(opt);
        });
    });
}

function updateKategori() { updatePilihanKategori('tipe', 'kategori'); }

function updatePilihanKategori(idTipe, idKategori) {
    const tipeEl = document.getElementById(idTipe);
    const selectEl = document.getElementById(idKategori);
    if(!tipeEl || !selectEl) return; 
    const tipe = tipeEl.value;
    selectEl.innerHTML = '';
    const list = KATEGORI_LIST[tipe] || [];
    list.forEach(item => {
        const option = document.createElement('option');
        option.value = item; option.text = item;
        selectEl.appendChild(option);
    });
}

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

// ===============================================
// 4. LOGIKA DATA & FILTER
// ===============================================

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
        document.getElementById('judulSaldo').innerText = "Sisa Saldo";
        trf.classList.remove('d-none');
    }
    pantauBudget(); refreshTampilan();
}

function refreshTampilan() {
    filterBulan = parseInt(document.getElementById('filterBulan').value);
    filterTahun = parseInt(document.getElementById('filterTahun').value);
    const dompetEl = document.getElementById('filterDompet');
    filterDompet = dompetEl ? dompetEl.value : 'semua';
    bacaDataTransaksi(); updateTombolEdit(); pantauTabungan(); pantauLangganan();
}

function bacaDataTransaksi() {
    db.collection('transaksi').orderBy('waktu', 'asc').onSnapshot(snapshot => {
        let html = '';
        let totalSaldo = modeTab === 'keluarga' ? saldoAwalKeluarga : saldoAwalPribadi;
        let stats = {}; 
        let daily = {};
        let allDocs = [];
        
        rawDataTransaksi = []; // Reset raw data

        snapshot.docs.forEach(doc => allDocs.push({ id: doc.id, ...doc.data() }));

        if(filterDompet !== 'semua') totalSaldo = 0; 

        allDocs.forEach(data => {
            const listAdmin = (typeof LIST_ADMIN !== 'undefined') ? LIST_ADMIN : [];
            const isAdminEntry = listAdmin.includes(data.email_pencatat);
            const isMyEntry = data.email_pencatat === currentUser.email;

            // --- 1. FILTER KEAMANAN TAB & SIMPAN KE RAW DATA ---
            let isValidTab = false;
            if (modeTab === 'keluarga') {
                if (isAdminEntry || isMyEntry) {
                    if (!isAdminEntry || data.is_family_trx !== false) isValidTab = true;
                }
            } else {
                if (isMyEntry && (data.is_family_trx === true && modeTab === 'pribadi') === false) isValidTab = true;
            }

            if (!isValidTab) return; 

            // Simpan ke RAW DATA untuk keperluan Export (Ini berisi data semua bulan)
            rawDataTransaksi.push(data);

            // --- 2. FILTER UNTUK TAMPILAN DASHBOARD ---
            
            // Filter Dompet
            let dataDompet = data.dompet || 'Tunai'; 
            if (filterDompet !== 'semua' && dataDompet !== filterDompet) return;

            // Hitung Saldo
            let val = parseInt(data.jumlah);
            if (data.tipe === 'pemasukan') totalSaldo += val; else totalSaldo -= val;

            // Filter Bulan & Tahun (Hanya untuk tampilan)
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

        // --- RENDER LIST (Hanya yang lolos filter bulan) ---
        let docsRev = allDocs.slice().reverse();
        docsRev.forEach(data => {
            // Re-check logic untuk list
            const listAdmin = (typeof LIST_ADMIN !== 'undefined') ? LIST_ADMIN : [];
            const isAdminEntry = listAdmin.includes(data.email_pencatat);
            const isMyEntry = data.email_pencatat === currentUser.email;
            let isValidTab = false;
            if (modeTab === 'keluarga') {
                if (isAdminEntry || isMyEntry) {
                    if (!isAdminEntry || data.is_family_trx !== false) isValidTab = true;
                }
            } else {
                if (isMyEntry && (data.is_family_trx === true && modeTab === 'pribadi') === false) isValidTab = true;
            }
            if (!isValidTab) return;

            let dataDompet = data.dompet || 'Tunai';
            if (filterDompet !== 'semua' && dataDompet !== filterDompet) return;

            let dateObj = data.waktu ? data.waktu.toDate() : new Date();
            if (dateObj.getMonth() === filterBulan && dateObj.getFullYear() === filterTahun) {
                if (modeTab === 'keluarga' && !isAdmin && isAdminEntry && data.kategori === 'Setoran Anggota') return;
                
                const cls = data.tipe === 'pemasukan' ? 'border-success border-start border-4' : 'border-danger border-start border-4';
                const ico = data.tipe === 'pemasukan' ? 'bi-arrow-down-circle-fill text-success' : 'bi-arrow-up-circle-fill text-danger';
                const badgeDompet = `<span class="badge bg-primary text-white border border-primary ms-1" style="font-size:0.7em; letter-spacing:0.5px;">${dataDompet}</span>`;

                let btn = '';
                if (isAdmin || isMyEntry) {
                    btn = `<div class="ms-2 text-end" style="z-index: 100; position: relative;">
                            <button class="btn btn-sm text-warning p-0 me-2" onclick="bukaModalEdit('${data.id}')"><i class="bi bi-pencil-square"></i></button>
                            <button class="btn btn-sm text-danger p-0" onclick="hapusData('${data.id}')"><i class="bi bi-trash"></i></button>
                           </div>`;
                }

                html += `<li class="list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm rounded ${cls}" style="z-index: 1; position: relative;">
                            <div class="d-flex align-items-center">
                                <i class="bi ${ico} fs-3 me-3"></i>
                                <div>
                                    <div class="fw-bold">${data.kategori} ${badgeDompet}</div>
                                    <div class="small text-muted">${dateObj.toLocaleDateString('id-ID')} • ${data.keterangan}</div>
                                    <div class="badge bg-light text-secondary border mt-1" style="font-size:0.7em">${data.nama_pencatat}</div>
                                </div>
                            </div>
                            <div class="text-end" style="z-index: 50; position: relative;">
                                <span class="fw-bold d-block ${data.tipe === 'pemasukan' ? 'text-success' : 'text-danger'}">Rp ${parseInt(data.jumlah).toLocaleString('id-ID')}</span>
                                ${btn}
                            </div>
                        </li>`;
            }
        });

        document.getElementById('daftarTransaksi').innerHTML = html || '<p class="text-center text-muted mt-3">Belum ada transaksi di bulan ini.</p>';
        renderChart(stats); renderLineChart(daily); renderBudgetProgress(stats);
    });
}

function renderChart(stats) {
    const ctx = document.getElementById('myChart'); if(myChart) myChart.destroy();
    if(Object.keys(stats).length === 0) return;
    myChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: document.body.classList.contains('dark-mode')?'#e0e0e0':'#666' } } } } });
}

function renderLineChart(daily) {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;
    if (myLineChart) myLineChart.destroy();

    const lbls = Object.keys(daily).sort((a,b) => a - b);
    const type = document.getElementById('tipeGrafik').value; 
    
    const dataMasuk = lbls.map(tgl => daily[tgl].pemasukan);
    const dataKeluar = lbls.map(tgl => daily[tgl].pengeluaran);
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e0e0e0' : '#666';
    
    let datasets = [];
    if (type === 'semua' || type === 'pemasukan') {
        datasets.push({ label: 'Pemasukan', data: dataMasuk, borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.1)', fill: true, tension: 0.4 });
    }
    if (type === 'semua' || type === 'pengeluaran') {
        datasets.push({ label: 'Pengeluaran', data: dataKeluar, borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', fill: true, tension: 0.4 });
    }

    myLineChart = new Chart(ctx, {
        type: 'line',
        data: { labels: lbls.map(t => `Tgl ${t}`), datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: (type === 'semua'), labels: { color: textColor } } },
            scales: {
                x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: textColor, callback: v => (v/1000)+'k' }, grid: { borderDash: [5,5], color: isDark ? '#333' : '#eee' } }
            }
        }
    });
}

// ===============================================
// 5. MODAL & FUNGSI TOMBOL
// ===============================================

function pantauLangganan() { db.collection('langganan').onSnapshot(s=>{let h='';const n=new Date(),p=`${n.getMonth()}-${n.getFullYear()}`;s.docs.forEach(d=>{const v=d.data(),id=d.id;if(modeTab==='keluarga'&&v.type!=='keluarga')return;if(modeTab!=='keluarga'&&(v.email_pemilik!==currentUser.email||v.type!=='pribadi'))return;let l=v.riwayat_bayar&&v.riwayat_bayar.includes(p),bg=l?'<span class="badge bg-success-subtle text-success border border-success rounded-pill">Lunas</span>':(n.getDate()>v.tgl_jatuh_tempo?'<span class="badge bg-danger text-white border rounded-pill">Telat!</span>':`<span class="badge bg-warning-subtle text-warning-emphasis border rounded-pill">Tgl ${v.tgl_jatuh_tempo}</span>`),btn=l?`<button class="btn btn-sm btn-light border" disabled>Lunas</button>`:`<button onclick="bayarLangganan('${id}','${v.nama}',${v.biaya})" class="btn btn-sm btn-primary rounded-pill shadow-sm">Bayar</button>`;h+=`<div class="col-md-6 col-12"><div class="card shadow-sm border-0 h-100"><div class="card-body d-flex justify-content-between align-items-center p-3"><div><div class="d-flex align-items-center gap-2 mb-1"><h6 class="fw-bold mb-0">${v.nama}</h6>${bg}</div><div class="small text-muted">Rp ${parseInt(v.biaya).toLocaleString()}</div></div><div class="d-flex align-items-center gap-2">${btn}<button onclick="hapusLangganan('${id}')" class="btn btn-link text-danger p-0"><i class="bi bi-x-circle"></i></button></div></div></div></div>`});document.getElementById('containerLangganan').innerHTML=h||'<div class="col-12 text-center text-muted small py-3">Belum ada tagihan.</div>'}); }
window.bukaModalTambahLangganan = () => { const s=document.getElementById('tglLangganan'); if(s.options.length===0){s.innerHTML='';for(let i=1;i<=31;i++){let o=document.createElement('option');o.value=i;o.text=`Tanggal ${i}`;s.appendChild(o);}} document.getElementById('namaLangganan').value=''; document.getElementById('biayaLangganan').value=''; new bootstrap.Modal(document.getElementById('modalTambahLangganan')).show(); }
window.simpanLanggananBaru = () => { const n=document.getElementById('namaLangganan').value, b=parseInt(document.getElementById('biayaLangganan').value), t=parseInt(document.getElementById('tglLangganan').value); if(!n||!b)return alert("Lengkapi data!"); db.collection('langganan').add({nama:n,biaya:b,tgl_jatuh_tempo:t,type:modeTab==='keluarga'?'keluarga':'pribadi',email_pemilik:currentUser.email,riwayat_bayar:[]}).then(()=>bootstrap.Modal.getInstance(document.getElementById('modalTambahLangganan')).hide()); }
window.bayarLangganan=(id,n,b)=>{if(b>globalSaldoSaatIni)return alert("❌ Saldo kurang!");if(!confirm(`Bayar ${n}?`))return;const now=new Date(),p=`${now.getMonth()}-${now.getFullYear()}`;Promise.all([db.collection('transaksi').add({tipe:'pengeluaran',kategori:'Tagihan',dompet:'Tunai',jumlah:b,keterangan:`Langganan: ${n}`,tanggal:now.toLocaleDateString('id-ID'),waktu:firebase.firestore.FieldValue.serverTimestamp(),email_pencatat:currentUser.email,nama_pencatat:currentUser.displayName,is_family_trx:(modeTab==='keluarga')}),db.collection('langganan').doc(id).update({riwayat_bayar:firebase.firestore.FieldValue.arrayUnion(p)})]).then(()=>alert("Lunas!"));}
window.hapusLangganan=(id)=>{if(confirm("Hapus?"))db.collection('langganan').doc(id).delete();}

function pantauTabungan() { db.collection('tabungan_goals').onSnapshot(s=>{let h='';const b=document.getElementById('btnTambahTabungan');if(modeTab==='keluarga'){if(isAdmin)b.classList.remove('d-none');else b.classList.add('d-none')}else{b.classList.remove('d-none')}s.docs.forEach(d=>{const v=d.data();if(modeTab==='keluarga'&&v.type!=='keluarga')return;if(modeTab!=='keluarga'&&(v.email_pemilik!==currentUser.email||v.type!=='pribadi'))return;const p=Math.min((v.terkumpul/v.target)*100,100);h+=`<div class="col-md-6"><div class="card shadow-sm border-0 h-100" style="cursor: pointer;" onclick="bukaModalSetorTabungan('${d.id}')"><div class="card-body"><div class="d-flex justify-content-between align-items-center mb-2"><h6 class="fw-bold mb-0">${v.nama}</h6><span class="badge bg-success rounded-pill">${Math.round(p)}%</span></div><div class="progress mb-2" style="height:10px"><div class="progress-bar bg-success" style="width:${p}%"></div></div><div class="d-flex justify-content-between small text-muted"><span>Terkumpul: <b>Rp ${parseInt(v.terkumpul).toLocaleString()}</b></span><span>Target: Rp ${parseInt(v.target).toLocaleString()}</span></div></div></div></div>`});document.getElementById('containerTabungan').innerHTML=h||'<div class="col-12 text-center text-muted small">Belum ada target.</div>'}); }
window.bukaModalTambahTabungan=()=>{document.getElementById('namaTabungan').value='';document.getElementById('targetTabungan').value='';document.getElementById('pilihanTenor').value='12';document.getElementById('inputTenorManual').classList.add('d-none');new bootstrap.Modal(document.getElementById('modalTambahTabungan')).show();}
window.cekTenorManual=()=>{const p=document.getElementById('pilihanTenor').value,i=document.getElementById('inputTenorManual');if(p==='manual'){i.classList.remove('d-none');i.focus();}else{i.classList.add('d-none');}}
window.simpanTabunganBaru=()=>{const n=document.getElementById('namaTabungan').value,t=parseInt(document.getElementById('targetTabungan').value);let te=document.getElementById('pilihanTenor').value;if(te==='manual')te=parseInt(document.getElementById('inputTenorManual').value);else te=parseInt(te);if(!n||!t||!te)return alert("Lengkapi data!");db.collection('tabungan_goals').add({nama:n,target:t,tenor:te,terkumpul:0,type:modeTab==='keluarga'?'keluarga':'pribadi',email_pemilik:currentUser.email,dibuat_pada:firebase.firestore.FieldValue.serverTimestamp()}).then(()=>location.reload());}
window.bukaModalSetorTabungan=(id)=>{db.collection('tabungan_goals').doc(id).get().then(doc=>{if(!doc.exists)return;const d=doc.data();document.getElementById('idTabunganSetor').value=id;document.getElementById('labelNamaTabungan').innerText=d.nama;document.getElementById('infoTarget').innerText=`Target: Rp ${parseInt(d.target).toLocaleString()}`;document.getElementById('infoSisa').innerText=`Sisa: Rp ${(d.target-d.terkumpul).toLocaleString()}`;document.getElementById('barProgressTabungan').style.width=`${Math.min((d.terkumpul/d.target)*100,100)}%`;
const btnGroup = document.getElementById('grupTombolAdmin');
const isOwner = (currentUser && d.email_pemilik === currentUser.email);
if (isAdmin || isOwner) { btnGroup.classList.remove('d-none'); } else { btnGroup.classList.add('d-none'); }
const l=document.getElementById('listCicilan');l.innerHTML='';const c=Math.ceil(d.target/(d.tenor||1));let tm=d.terkumpul;for(let i=1;i<=(d.tenor||1);i++){let ln=false;if(tm>=c){ln=true;tm-=c}else if(tm>0){tm=0}let dv=document.createElement('div');if(ln)dv.innerHTML=`<div class="p-3 bg-success-subtle border border-success rounded d-flex justify-content-between align-items-center mb-2"><div><span class="fw-bold text-success">Bulan ke-${i}</span><div class="small">Rp ${c.toLocaleString()}</div></div><span class="badge bg-success">Lunas</span></div>`;else dv.innerHTML=`<div class="p-3 bg-light border rounded d-flex justify-content-between align-items-center mb-2"><div><span class="fw-bold text-muted">Bulan ke-${i}</span><div class="small">Rp ${c.toLocaleString()}</div></div><button onclick="prosesBayarCicilan('${id}',${c},'Bulan ke-${i}')" class="btn btn-sm btn-outline-primary rounded-pill">Bayar</button></div>`;l.appendChild(dv);}new bootstrap.Modal(document.getElementById('modalSetorTabungan')).show();});}
window.prosesBayarCicilan=(id,n,k)=>{if(n>globalSaldoSaatIni)return alert("❌ Saldo kurang!");const trx={tipe:'pengeluaran',kategori:'Tabungan',dompet:'Tunai',jumlah:n,tanggal:new Date().toLocaleDateString('id-ID'),waktu:firebase.firestore.FieldValue.serverTimestamp(),email_pencatat:currentUser.email,nama_pencatat:currentUser.displayName,keterangan:k,is_family_trx:(modeTab==='keluarga')};Promise.all([db.collection('tabungan_goals').doc(id).update({terkumpul:firebase.firestore.FieldValue.increment(n)}),db.collection('transaksi').add(trx)]).then(()=>{bootstrap.Modal.getInstance(document.getElementById('modalSetorTabungan')).hide();setTimeout(()=>bukaModalSetorTabungan(id),500);});}
window.simpanSetoranManual=()=>{const id=document.getElementById('idTabunganSetor').value,v=parseInt(document.getElementById('inputSetoranManual').value);if(v>0)prosesBayarCicilan(id,v,"Setoran Manual");}
window.hapusTabungan=()=>{if(confirm("Hapus?"))db.collection('tabungan_goals').doc(document.getElementById('idTabunganSetor').value).delete().then(()=>location.reload());}
window.resetTabungan=()=>{if(confirm("Reset?"))db.collection('tabungan_goals').doc(document.getElementById('idTabunganSetor').value).update({terkumpul:0}).then(()=>location.reload());}

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
        db.collection('transaksi').add({tipe:'pengeluaran',kategori:'Transfer',dompet:'Tunai',jumlah:jum,keterangan:'Ke Kas',tanggal:new Date().toLocaleDateString('id-ID'),waktu:firebase.firestore.FieldValue.serverTimestamp(),email_pencatat:currentUser.email,nama_pencatat:currentUser.displayName,is_family_trx:false}),
        db.collection('transaksi').add({tipe:'pemasukan',kategori:'Setoran Anggota',dompet:'Tunai',jumlah:jum,keterangan:`Dari ${currentUser.displayName}`,tanggal:new Date().toLocaleDateString('id-ID'),waktu:firebase.firestore.FieldValue.serverTimestamp(),email_pencatat:((typeof LIST_ADMIN !== 'undefined' && LIST_ADMIN.length > 0) ? LIST_ADMIN[0] : currentUser.email),nama_pencatat:currentUser.displayName,is_family_trx:true})
    ]).then(()=>location.reload());
}
window.bukaModalBudget = () => { ['Makan','Jajan','Transport','Belanja','Tagihan'].forEach(k => document.getElementById('budget'+k).value = dataBudget[k]||''); new bootstrap.Modal(document.getElementById('modalAturBudget')).show(); }
window.simpanBudget = () => { let d={}; ['Makan','Jajan','Transport','Belanja','Tagihan'].forEach(k=>d[k]=parseInt(document.getElementById('budget'+k).value)||0); db.collection('pengaturan').doc(modeTab==='keluarga'?'budget_keluarga':'budget_'+currentUser.email).set(d).then(()=>{bootstrap.Modal.getInstance(document.getElementById('modalAturBudget')).hide();location.reload();}); }
window.resetBudget = () => { if(confirm("Reset?")) db.collection('pengaturan').doc(modeTab==='keluarga'?'budget_keluarga':'budget_'+currentUser.email).set({Makan:0,Jajan:0,Transport:0,Belanja:0,Tagihan:0}).then(()=>location.reload()); }
function pantauBudget() { db.collection('pengaturan').doc(modeTab==='keluarga'?'budget_keluarga':'budget_'+currentUser.email).onSnapshot(doc=>{dataBudget=doc.exists?doc.data():{};renderBudgetProgress(currentPengeluaran);}); }
function renderBudgetProgress(exp) {
    let h=''; ['Makan','Jajan','Transport','Belanja','Tagihan'].forEach(k=>{ if((dataBudget[k]||0)>0){ let p=Math.min(((exp[k]||0)/dataBudget[k])*100,100); h+=`<div class="mb-3"><div class="d-flex justify-content-between small mb-1"><span class="fw-bold">${k}</span><span class="text-muted">${(exp[k]||0).toLocaleString()} / ${dataBudget[k].toLocaleString()}</span></div><div class="progress rounded-pill bg-light border" style="height:12px"><div class="progress-bar ${p>90?'bg-danger':(p>75?'bg-warning':'bg-success')} rounded-pill" style="width:${p}%"></div></div></div>`; } }); document.getElementById('containerBudget').innerHTML=h||'<p class="text-center small text-muted">Belum ada anggaran.</p>';
}

// ==========================================
// 6. FUNGSI EDIT & HAPUS
// ==========================================

window.bukaModalEdit = (id) => { 
    db.collection('transaksi').doc(id).get().then(doc => { 
        if(doc.exists) { 
            const d = doc.data(); 
            document.getElementById('editId').value = id; 
            document.getElementById('editTipe').value = d.tipe; 
            if(typeof updatePilihanKategori === 'function') {
                updatePilihanKategori('editTipe', 'editKategori'); 
            }
            setTimeout(()=>{ 
                document.getElementById('editKategori').value = d.kategori;
                document.getElementById('editDompet').value = d.dompet || 'Tunai'; 
            }, 100); 
            document.getElementById('editJumlah').value = d.jumlah; 
            document.getElementById('editKeterangan').value = d.keterangan; 
            new bootstrap.Modal(document.getElementById('modalEditTransaksi')).show(); 
        } 
    }); 
}

window.updateTransaksi = () => { 
    db.collection('transaksi').doc(document.getElementById('editId').value).update({ 
        tipe: document.getElementById('editTipe').value, 
        dompet: document.getElementById('editDompet').value, 
        kategori: document.getElementById('editKategori').value, 
        jumlah: parseInt(document.getElementById('editJumlah').value), 
        keterangan: document.getElementById('editKeterangan').value 
    }).then(()=>location.reload()); 
}

window.hapusData = (id) => { 
    if(confirm("Hapus data ini permanen?")) {
        db.collection('transaksi').doc(id).delete();
    }
}

// ==========================================
// 7. 🔥 FUNGSI EXPORT MODAL & PREVIEW BARU 🔥
// ==========================================

// Buka Modal Export dan Set Default ke Bulan Sekarang
window.bukaModalExport = () => {
    // Set default value ke bulan & tahun sekarang
    document.getElementById('exportBulan').value = new Date().getMonth();
    document.getElementById('exportTahun').value = new Date().getFullYear();
    
    // Tampilkan preview awal
    renderPreviewExport();
    
    // Buka modal
    new bootstrap.Modal(document.getElementById('modalExport')).show();
}

// Render Preview Data sesuai Pilihan Dropdown Modal
window.renderPreviewExport = () => {
    const b = parseInt(document.getElementById('exportBulan').value);
    const t = parseInt(document.getElementById('exportTahun').value);
    
    let totalMasuk = 0;
    let totalKeluar = 0;
    let count = 0;

    // Filter dari rawDataTransaksi (Data Mentah)
    rawDataTransaksi.forEach(data => {
        let dateObj = data.waktu ? data.waktu.toDate() : new Date();
        
        // Cek kesesuaian Bulan & Tahun
        if (dateObj.getMonth() === b && dateObj.getFullYear() === t) {
            
            // Khusus Keluarga: Admin tidak melihat 'Setoran Anggota' sendiri
            if (modeTab === 'keluarga' && !isAdmin && data.email_pencatat === currentUser.email && data.kategori === 'Setoran Anggota') return; 

            let val = parseInt(data.jumlah);
            if (data.tipe === 'pemasukan') totalMasuk += val; else totalKeluar += val;
            count++;
        }
    });

    // Update UI Preview
    document.getElementById('prevMasuk').innerText = `Rp ${totalMasuk.toLocaleString('id-ID')}`;
    document.getElementById('prevKeluar').innerText = `Rp ${totalKeluar.toLocaleString('id-ID')}`;
    document.getElementById('prevCount').innerText = `${count} Data`;
}

// Proses Download File CSV dari Data Preview
window.downloadFileExport = () => {
    const b = parseInt(document.getElementById('exportBulan').value);
    const t = parseInt(document.getElementById('exportTahun').value);
    
    const namaBulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const labelBulan = namaBulan[b];

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Tanggal;Tipe;Dompet;Kategori;Jumlah;Keterangan;Pencatat\n";

    let dataAda = false;

    rawDataTransaksi.forEach(row => {
        let dateObj = row.waktu ? row.waktu.toDate() : new Date();
        
        // Filter lagi saat download
        if (dateObj.getMonth() === b && dateObj.getFullYear() === t) {
             if (modeTab === 'keluarga' && !isAdmin && row.email_pencatat === currentUser.email && row.kategori === 'Setoran Anggota') return;

            let ket = row.keterangan ? row.keterangan.replace(/;/g, " ").replace(/\n/g, " ") : "-";
            let tglStr = dateObj.toLocaleDateString('id-ID');
            
            let baris = `${tglStr};${row.tipe};${row.dompet||'Tunai'};${row.kategori};${row.jumlah};${ket};${row.nama_pencatat}`;
            csvContent += baris + "\n";
            dataAda = true;
        }
    });

    if (!dataAda) return alert("Tidak ada data di bulan tersebut!");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_${modeTab}_${labelBulan}_${t}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// 8. FORM SUBMIT
// ==========================================
document.getElementById('formTransaksi').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = document.getElementById('tipe').value; 
    const j = parseInt(document.getElementById('jumlah').value);
    
    if(t==='pengeluaran' && j>globalSaldoSaatIni) return alert("❌ Saldo Kurang!");
    
    db.collection('transaksi').add({
        tipe: t,
        kategori: document.getElementById('kategori').value,
        dompet: document.getElementById('inputDompet').value,
        jumlah: j,
        keterangan: document.getElementById('keterangan').value,
        tanggal: new Date().toLocaleDateString('id-ID'),
        waktu: firebase.firestore.FieldValue.serverTimestamp(),
        email_pencatat: currentUser.email,
        nama_pencatat: currentUser.displayName,
        is_family_trx: (modeTab === 'keluarga') 
    }).then(() => document.getElementById('formTransaksi').reset());
});

function loginGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut(); }