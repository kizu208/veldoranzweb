// Alamat server Minecraft
const SERVER_ADDRESS = 'mc.veldoranzsmp.xyz';
const API_URL = `https://api.mcstatus.io/v2/status/java/${SERVER_ADDRESS}`;

// Supabase setup
const SUPABASE_URL = 'https://rnviyaomamtvianurhzv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJudml5YW9tYW10dmlhbnVyaHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NzI4MDYsImV4cCI6MjA2NDU0ODgwNn0.kJYEqBwxGr--1xoOs1xN1F7pkWtbQ0gyW1WlM2G3RbY';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen-elemen DOM
const serverStatus = document.getElementById('server-status');
const onlinePlayers = document.getElementById('online-players');
const maxPlayers = document.getElementById('max-players');
const serverIp = document.getElementById('server-ip');
const playersList = document.getElementById('players-list');
const offlinePlayersList = document.getElementById('offline-players-list');
const totalPlayers = document.getElementById('total-players');
const totalOfflinePlayers = document.getElementById('total-offline-players');

// Fungsi untuk memformat waktu terakhir dilihat
function formatLastSeen(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Fungsi untuk membuat kartu pemain online
function createPlayerCard(player, isOnline = true) {
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    
    // Pastikan kita memiliki nama pemain yang valid
    let playerName = 'Unknown';
    if (typeof player === 'string') {
        playerName = player;
    } else if (player && player.name) {
        playerName = player.name;
    } else if (player && player.name_raw) {
        playerName = player.name_raw;
    }
    
    playerCard.innerHTML = `
        <img src="https://minotar.net/avatar/${playerName}/64" 
             alt="${playerName}" 
             class="player-avatar"
             onerror="this.src='https://mc-heads.net/avatar/steve'">
        <div class="player-info">
            <div class="player-name">${playerName}</div>
            <div class="player-seen">${isOnline ? 'Online Now' : 'Offline'}</div>
            ${!isOnline && player.last_seen ? `<div class="last-seen">terakhir on : <br>${formatLastSeen(player.last_seen)}</div>` : ''}
        </div>
    `;
    
    return playerCard;
}

// Fungsi untuk mendapatkan pemain offline dari Supabase
async function getOfflinePlayers() {
    try {
        console.log('Mengambil data pemain offline dari Supabase...');
        const { data, error } = await supabaseClient
            .from('players')
            .select('*')
            .eq('is_online', false)
            .order('last_seen', { ascending: false });

        if (error) {
            console.error('Error mengambil data pemain offline:', error);
            return [];
        }

        console.log('Data pemain offline:', data);
        return data || [];
    } catch (error) {
        console.error('Error dalam getOfflinePlayers:', error);
        return [];
    }
}

// Fungsi untuk memperbarui tampilan pemain offline
async function updateOfflinePlayersList() {
    try {
        const offlinePlayers = await getOfflinePlayers();
        const offlinePlayersList = document.getElementById('offline-players-list');
        const totalOfflinePlayers = document.getElementById('total-offline-players');

        // Update total
        totalOfflinePlayers.textContent = offlinePlayers.length;

        // Bersihkan list yang ada
        offlinePlayersList.innerHTML = '';

        if (offlinePlayers.length > 0) {
            // Buat fragment untuk menampung semua kartu pemain
            const fragment = document.createDocumentFragment();
            
            offlinePlayers.forEach(player => {
                if (player.name && player.name !== 'Unknown') {
                    const playerCard = createPlayerCard(player, false);
                    fragment.appendChild(playerCard);
                }
            });

            offlinePlayersList.appendChild(fragment);
        } else {
            offlinePlayersList.innerHTML = '<p>Belum ada riwayat pemain</p>';
        }
    } catch (error) {
        console.error('Error dalam updateOfflinePlayersList:', error);
        document.getElementById('offline-players-list').innerHTML = '<p>Gagal memuat riwayat pemain</p>';
    }
}

// Fungsi untuk menyimpan/memperbarui data pemain di Supabase
async function updatePlayerData(playerName, isOnline) {
    if (!playerName || playerName === 'Unknown') {
        console.log('Skipping invalid player name:', playerName);
        return;
    }

    try {
        console.log(`Updating player ${playerName} with status ${isOnline}`);
        const timestamp = new Date().toISOString();
        
        const { data, error } = await supabaseClient
            .from('players')
            .upsert({
                name: playerName,
                last_seen: timestamp,
                is_online: isOnline
            }, {
                onConflict: 'name'
            });

        if (error) {
            console.error('Error updating player:', error);
        } else {
            console.log('Player data updated successfully:', data);
        }
    } catch (error) {
        console.error('Error updating player data:', error);
    }
}

// Fungsi untuk memperbarui status server
async function updateServerStatus() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        console.log('Server response:', data);
        
        // Update status server
        if (data.online) {
            serverStatus.textContent = 'Online';
            serverStatus.className = 'online';
            
            // Update jumlah pemain
            if (data.players) {
                onlinePlayers.textContent = data.players.online || 0;
                maxPlayers.textContent = data.players.max || 0;
                totalPlayers.textContent = data.players.online || 0;

                // Dapatkan daftar pemain online saat ini dari database
                const { data: currentOnlinePlayers } = await supabaseClient
                    .from('players')
                    .select('name')
                    .eq('is_online', true);
                
                const currentOnlineNames = currentOnlinePlayers ? currentOnlinePlayers.map(p => p.name) : [];
                
                // Update pemain online dari API
                const onlinePlayersList = [];
                const newPlayerCards = document.createDocumentFragment();
                
                if (data.players.list && Array.isArray(data.players.list)) {
                    // Proses semua pemain online secara parallel
                    const updatePromises = data.players.list.map(async (player) => {
                        const playerName = typeof player === 'string' ? player : (player.name || player.name_raw);
                        if (playerName && playerName !== 'Unknown') {
                            onlinePlayersList.push(playerName);
                            
                            // Cek apakah pemain sudah ada di daftar
                            const existingCard = playersList.querySelector(`[data-player="${playerName}"]`);
                            if (!existingCard) {
                                const playerCard = createPlayerCard({ name: playerName, is_online: true }, true);
                                playerCard.setAttribute('data-player', playerName);
                                newPlayerCards.appendChild(playerCard);
                            }
                            
                            // Update hanya jika status berubah
                            if (!currentOnlineNames.includes(playerName)) {
                                await updatePlayerData(playerName, true);
                            }
                        }
                    });
                    await Promise.all(updatePromises);
                }

                // Hapus kartu pemain yang sudah tidak online
                const existingCards = playersList.querySelectorAll('.player-card');
                existingCards.forEach(card => {
                    const playerName = card.getAttribute('data-player');
                    if (!onlinePlayersList.includes(playerName)) {
                        card.remove();
                    }
                });

                // Tambahkan kartu pemain baru
                playersList.appendChild(newPlayerCards);

                // Set pemain yang tidak ada di list sebagai offline
                const offlinePromises = currentOnlineNames
                    .filter(name => !onlinePlayersList.includes(name))
                    .map(name => updatePlayerData(name, false));
                await Promise.all(offlinePromises);
            }
        } else {
            // Server offline tapi bukan error
            serverStatus.textContent = 'Offline';
            serverStatus.className = 'offline';
            onlinePlayers.textContent = '0';
            maxPlayers.textContent = '0';
            totalPlayers.textContent = '0';
            
            // Jangan langsung kosongkan, tapi fade out
            const existingCards = playersList.querySelectorAll('.player-card');
            existingCards.forEach(card => card.remove());
            playersList.innerHTML = '<p>Server sedang offline</p>';
            
            // Set semua pemain sebagai offline secara parallel
            const { data: onlinePlayers } = await supabaseClient
                .from('players')
                .select('name')
                .eq('is_online', true);
            
            if (onlinePlayers && onlinePlayers.length > 0) {
                const offlinePromises = onlinePlayers.map(player => 
                    updatePlayerData(player.name, false)
                );
                await Promise.all(offlinePromises);
            }
        }

    } catch (error) {
        console.error('Error:', error);
        // Tetap tampilkan sebagai offline, bukan error
        serverStatus.textContent = 'Offline';
        serverStatus.className = 'offline';
        onlinePlayers.textContent = '0';
        maxPlayers.textContent = '0';
        totalPlayers.textContent = '0';
        
        // Jangan langsung kosongkan
        const existingCards = playersList.querySelectorAll('.player-card');
        existingCards.forEach(card => card.remove());
        playersList.innerHTML = '<p>Server sedang offline</p>';
    } finally {
        // Update alamat server
        serverIp.textContent = SERVER_ADDRESS;

        // Selalu update daftar pemain offline setelah update status
        await updateOfflinePlayersList();
    }
}

// Fungsi untuk menyalin ke clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Tampilkan feedback visual
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = 'Alamat server disalin!';
        document.body.appendChild(notification);

        // Hapus notifikasi setelah 2 detik
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }).catch(err => {
        console.error('Gagal menyalin teks: ', err);
    });
}

// Tambahkan event listener untuk alamat server
document.addEventListener('DOMContentLoaded', function() {
    const javaAddress = document.querySelector('.address-item:nth-child(1)');
    const bedrockAddress = document.querySelector('.address-item:nth-child(2)');

    javaAddress.addEventListener('click', () => {
        copyToClipboard('mc.veldoranz.xyz');
    });

    bedrockAddress.addEventListener('click', () => {
        copyToClipboard('mc.veldoranz.xyz:19132');
    });
});

// Tunggu sampai dokumen selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded, initializing...');
    // Perbarui status setiap 2 detik
    updateServerStatus();
    setInterval(updateServerStatus, 2000);
}); 
