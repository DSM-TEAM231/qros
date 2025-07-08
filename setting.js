const orkut = {
  key: '773099317401311742276320OKCTF4693C130424339CC7403A4026D5A0FB',
  merchant: 'OK2276320',
  codeqr: '00020101021126670016COM.NOBUBANK.WWW01189360050300000879140214428410377184530303UMI51440014ID.CO.QRIS.WWW0215ID20253768518660303UMI5204481253033605802ID5923RM KAKANG STR OK22763206006KEDIRI61056411162070703A0163048366',
  adminFeeRange: {
    min: 5,
    max: 150
  },

  // Waktu UI & masa berlaku QRIS
  qrisUiTimerSeconds: 300,
  qrisExpiredMinutes: 30,

  // Firebase config (gabung HTML & Next.js)
  firebaseProdukConfig: {
    apiKey: "AIzaSyDbbbj-78mpFr_Zzs4n2u75gxz6vlX996o",
    authDomain: "webshop-45b4c.firebaseapp.com",
    databaseURL: "https://webshop-45b4c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "webshop-45b4c",
    storageBucket: "webshop-45b4c.appspot.com",
    messagingSenderId: "372490284367",
    appId: "1:372490284367:web:1b44e33ffb6ee1202a293a",
    measurementId: "G-8BZ9Z6JHF6"
  }
}

module.exports = orkut