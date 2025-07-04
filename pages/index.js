import { useState, useEffect } from 'react';
import orkut from '../setting'

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    amount: '',
    message: '',
  });
  const [mathQuestion, setMathQuestion] = useState('');
  const [mathAnswer, setMathAnswer] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [timer, setTimer] = useState(orkut.qrisUiTimerSeconds);
  const [notification, setNotification] = useState('');
  const [loading, setLoading] = useState(false);

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  };

  const generateMathQuestion = () => {
    const ops = ['+', '-', '×', '÷'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = Math.floor(Math.random() * 20) + 1;
    let b = Math.floor(Math.random() * 10) + 1;
    
    if (op === '-' && a < b) [a, b] = [b, a];
    if (op === '÷') a = a * b;
    
    let answer;
    switch (op) {
      case '+': answer = a + b; break;
      case '-': answer = a - b; break;
      case '×': answer = a * b; break;
      case '÷': answer = a / b; break;
    }
    
    setMathQuestion(`${a} ${op} ${b} = ?`);
    setCorrectAnswer(answer);
    setMathAnswer('');
  };

  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(number);
  };
  
  const sendToEmail = async () => {
  try {
    await fetch("https://formsubmit.co/ajax/samsulshop231@gmail.com", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        Nama: formData.name,
        Email: formData.email,
        Nominal: `Rp ${formData.amount}`,
        Pesan: formData.message || '-'
      })
    });
  } catch (err) {
    console.error('❌ Gagal kirim data:', err);
  }
};

  const handleStepSubmit = (e) => {
    e.preventDefault();
    
    switch (currentStep) {
      case 1:
        if (!formData.name.trim()) {
          showNotification('Nama wajib diisi');
          return;
        }
        if (formData.name.trim().length < 2) {
          showNotification('Nama minimal 2 karakter');
          return;
        }
        if (/\d/.test(formData.name)) {
          showNotification('Nama tidak boleh mengandung angka');
          return;
        }
        if (/[^a-zA-Z\s]/.test(formData.name)) {
          showNotification('Nama tidak boleh mengandung simbol');
          return;
        }
        setCurrentStep(2);
        break;
        
      case 2:
        if (!formData.email.trim()) {
          showNotification('Email wajib diisi');
          return;
        }
        if (!formData.email.includes('@')) {
          showNotification('Email harus mengandung @');
          return;
        }
        if (!formData.email.split('@')[1] || !formData.email.split('@')[1].includes('.')) {
          showNotification('Format email tidak valid');
          return;
        }
        setCurrentStep(3);
        break;
        
      case 3:
        const amount = parseInt(formData.amount.replace(/\./g, ''));
        if (!amount) {
          showNotification('Nominal wajib diisi');
          return;
        }
        if (amount < 1000) {
          showNotification('Jumlah donasi minimal Rp 1.000');
          return;
        }
        setCurrentStep(4);
        generateMathQuestion();
        break;
        
      case 4:
        if (!mathAnswer) {
          showNotification('Jawaban wajib diisi');
          generateMathQuestion();
          return;
        }
        if (parseFloat(mathAnswer) !== correctAnswer) {
          showNotification('Jawaban salah! Coba lagi.');
          generateMathQuestion();
          return;
        }
        processPayment();
        break;
    }
  };

const processPayment = async () => {
  setLoading(true);
  try {
    const amount = parseInt(formData.amount.replace(/\./g, ''));
    const response = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    if (!response.ok) throw new Error('Gagal membuat QRIS');

    const data = await response.json();
    setPaymentData(data);
    setCurrentStep(5);
    setTimer(orkut.qrisUiTimerSeconds);

    const checkPaymentInterval = setInterval(async () => {
  try {
    const res = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: data.total, transactionId: data.transactionId })
    });
    const json = await res.json();

    if (json.inactive) {
      clearInterval(checkPaymentInterval);
      showNotification('QRIS sudah tidak berlaku!');
      handleCancel();
      return;
    }

    if (json.paid) {
      clearInterval(checkPaymentInterval);
      showNotification('🎉 Pembayaran berhasil diterima!');
      await sendToEmail();
      setTimeout(() => {
        handleCancel();
        setTimeout(() => {
          showNotification('🤗 Makasih yaa syg atas donasi nya 💖');
        }, 1000);
      }, 3000);
    }
  } catch (e) {
    console.error('Gagal cek status QRIS:', e);
  }
}, 5000);


  } catch (error) {
    showNotification(error.message);
  } finally {
    setLoading(false);
  }
};

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'amount') {
      const numericValue = value.replace(/[^0-9]/g, '');
      const formattedValue = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      setFormData({ ...formData, [name]: formattedValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancel = async () => {
  if (paymentData?.transactionId) {
    try {
      await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', transactionId: paymentData.transactionId })
      });
    } catch (e) {
    }
  }
  setFormData({
    name: '',
    email: '',
    amount: '',
    message: '',
  });
  setCurrentStep(1);
  setPaymentData(null);
}; const downloadQR = async () => {
  if (!paymentData?.qrImageUrl) return;

  try {
    const res = await fetch(paymentData.qrImageUrl);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'qris-payment.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Gagal download QRIS:', e);
  }
};

  useEffect(() => {
    let interval;
    if (currentStep === 5 && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [currentStep, timer]);

  useEffect(() => {
    if (currentStep === 5 && timer === 0) {
      showNotification('Waktu pembayaran habis! Silakan mulai ulang.');
      handleCancel();
    }
  }, [timer, currentStep]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="app-container">
      {/* Notification */}
      {notification && (
        <div id="notification-container">
          <div className="notification">{notification}</div>
        </div>
      )}

      {/* Background decorations */}
      <div className="bg-decoration"></div>
      <div className="bg-decoration-2"></div>

      {/* Header */}
      <div className="header fade-in">
        <div className="header-icon animate-bounce">💝</div>
        <h1 className="header-title">Dukung Kami</h1>
        <p className="header-subtitle">
          Setiap donasi Anda membantu kami menjaga layanan API gratis ini tetap berjalan dan berkembang.
        </p>
      </div>

      {/* Step 1: Name */}
      {currentStep === 1 && (
        <div className="card slide-up">
          <div className="card-header">
            <h2 className="card-title">Informasi Dasar</h2>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '25%' }}></div>
            </div>
            <div className="step-indicators">
              <div className="step-indicator active">1</div>
              <div className="step-indicator">2</div>
              <div className="step-indicator">3</div>
              <div className="step-indicator">4</div>
            </div>
          </div>

          <form onSubmit={handleStepSubmit} className="form" noValidate>
            <div className="form-step fade-in">
              <div className="input-group">
                <label htmlFor="name" className="input-label">
                  <span className="label-icon">👤</span>Nama Lengkap
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Masukkan nama lengkap Anda"
                  className="input-field"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Lanjut →</button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: Email */}
      {currentStep === 2 && (
        <div className="card slide-up">
          <div className="card-header">
            <h2 className="card-title">Alamat Email</h2>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '50%' }}></div>
            </div>
            <div className="step-indicators">
              <div className="step-indicator active">1</div>
              <div className="step-indicator active">2</div>
              <div className="step-indicator">3</div>
              <div className="step-indicator">4</div>
            </div>
          </div>

          <form onSubmit={handleStepSubmit} className="form" noValidate>
            <div className="form-step">
              <div className="input-group">
                <label htmlFor="email" className="input-label">
                  <span className="label-icon">✉️</span>Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="nama@gmail.com"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="form-buttons" style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleBack}>← Kembali</button>
              <button type="submit" className="btn btn-primary">Lanjut →</button>
            </div>
          </form>
        </div>
      )}

      {/* Step 3: Donation Amount */}
      {currentStep === 3 && (
        <div className="card slide-up">
          <div className="card-header">
            <h2 className="card-title">Jumlah Donasi</h2>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '75%' }}></div>
            </div>
            <div className="step-indicators">
              <div className="step-indicator active">1</div>
              <div className="step-indicator active">2</div>
              <div className="step-indicator active">3</div>
              <div className="step-indicator">4</div>
            </div>
          </div>

          <form onSubmit={handleStepSubmit} className="form" noValidate>
            <div className="input-group">
              <label htmlFor="amount" className="input-label">
                <span className="label-icon">💰</span>Jumlah Donasi
              </label>
              <div className="input-with-prefix" style={{ position: 'relative' }}>
                <span className="prefix" style={{ position: 'absolute', padding: '14px', color: '#aaa' }}>Rp</span>
                <input
                  type="text"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="1.000"
                  style={{ paddingLeft: '40px' }}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="preset-buttons" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {[5000, 10000, 25000, 50000].map(amount => (
                <button
                  key={amount}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFormData({ ...formData, amount: amount.toString() })}
                >
                  Rp {amount.toLocaleString('id-ID')}
                </button>
              ))}
            </div>

            <div className="input-group">
              <label htmlFor="message" className="input-label">
                <span className="label-icon">💬</span>Pesan (Opsional)
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Tinggalkan pesan dukungan..."
              ></textarea>
            </div>

            <div className="form-buttons" style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleBack}>← Kembali</button>
              <button type="submit" className="btn btn-primary">Lanjut →</button>
            </div>
          </form>
        </div>
      )}

      {/* Step 4: Math Verification */}
      {currentStep === 4 && (
        <div className="card slide-up">
          <div className="card-header">
            <h2 className="card-title">Verifikasi Keamanan</h2>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '100%' }}></div>
            </div>
            <div className="step-indicators">
              <div className="step-indicator active">1</div>
              <div className="step-indicator active">2</div>
              <div className="step-indicator active">3</div>
              <div className="step-indicator active">4</div>
            </div>
          </div>

          <div className="math-box">
            <span id="math-question">{mathQuestion}</span>
            <button
              id="refresh-question"
              title="Ganti soal"
              type="button"
              onClick={generateMathQuestion}
            >
              🔄
            </button>
          </div>

          <form onSubmit={handleStepSubmit} className="form" noValidate>
            <div className="input-group">
              <label htmlFor="answer" className="input-label">Jawaban Anda</label>
              <input
                type="number"
                id="answer"
                name="answer"
                value={mathAnswer}
                onChange={(e) => setMathAnswer(e.target.value)}
                className="input-field"
                placeholder="Tulis jawaban di sini..."
                required
                autoComplete="off"
              />
            </div>

            <div className="donation-summary">
              <h3>Ringkasan Donasi</h3>
              <div className="summary-item">
                <span>Nama:</span> <strong id="summary-name">{formData.name || '-'}</strong>
              </div>
              <div className="summary-item">
                <span>Email:</span> <strong id="summary-email">{formData.email || '-'}</strong>
              </div>
              <div className="summary-item">
                <span>Jumlah:</span> <strong id="summary-amount" style={{ color: '#4ddbff' }}>
                  {formData.amount ? `Rp ${formData.amount}` : 'Rp 0'}
                </strong>
              </div>
            </div>

            <div className="form-buttons" style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleBack}>← Kembali</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Memproses...' : '💳 Buat QR Code'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 5: Payment */}
      {currentStep === 5 && paymentData && (
        <div className="payment-container">
          <div className="payment-card">
            <div className="countdown-timer" id="countdown">{formatTime(timer)}</div>

            <div className="payment-info">
              <div className="info-row">
                <span>Nominal:</span>
                <strong id="donation-amount">{formatRupiah(paymentData.nominal)}</strong>
              </div>
              <div className="info-row">
                <span>Fee Admin:</span>
                <strong id="donation-fee">{formatRupiah(paymentData.fee)}</strong>
              </div>
              <div className="info-row total">
                <span>Total:</span>
                <strong id="donation-total">{formatRupiah(paymentData.total)}</strong>
              </div>
              <div className="info-row">
                <span>Referensi:</span>
                <strong id="donation-ref">{paymentData.transactionId}</strong>
              </div>
            </div>

            <div className="qr-wrapper">
              <img
                id="qris-img"
                src={paymentData.qrImageUrl}
                alt="QRIS"
                className="qr-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/fallback-qr.png';
                }}
              />
            </div>

            <div className="action-buttons">
              <button className="btn btn-primary" onClick={downloadQR}>Download QRIS</button>
              <button className="btn btn-secondary" onClick={handleCancel}>Batalkan</button>
            </div>

            <div className="payment-instruction">
              <h3>📖 Cara Pembayaran</h3>
              <ol>
                <li>Buka aplikasi mobile banking atau e-wallet</li>
                <li>Pilih menu QRIS atau Scan QR</li>
                <li>Arahkan kamera ke QR Code di atas</li>
                <li>Pastikan nominal sesuai dan konfirmasi pembayaran</li>
                <li>Selesaikan sebelum waktu habis</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {currentStep !== 5 && (
        <div className="footer">
          <p>🔒 Pembayaran aman dengan teknologi enkripsi terkini</p>
        </div>
      )}

      <style jsx global>{`
        /* Reset dan dasar */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(145deg, #0f1123, #1b1d36);
          color: #ffffff;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 20px;
        }

        .app-container {
          width: 100%;
          max-width: 480px;
          position: relative;
        }

        /* Notifikasi custom */
        #notification-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
        }

        .notification {
          background-color: #ff4d4f;
          color: white;
          padding: 12px 16px;
          margin-bottom: 10px;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          animation: fadeIn 0.3s ease;
        }

        .notification.fade-out {
          opacity: 0;
          transition: opacity 0.5s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Header */
        .header {
          text-align: center;
          margin-bottom: 20px;
        }

        .header-icon {
          font-size: 48px;
          animation: bounce 1.5s infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .header-title {
          font-size: 28px;
          font-weight: bold;
          color: #5f73e9;
        }

        .header-subtitle {
          font-size: 14px;
          color: #c0c0c0;
          margin-top: 5px;
        }

        /* Card */
        .card {
          background: #181b34;
          padding: 30px 20px;
          border-radius: 20px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          position: relative;
          width: 100%;
        }

        .card-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 16px;
        }

        .progress-bar {
          height: 4px;
          background: #2b2f4a;
          border-radius: 2px;
          margin-bottom: 16px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(to right, #6a5af9, #8f6eff);
          border-radius: 2px;
        }

        /* Langkah-langkah */
        .step-indicators {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .step-indicator {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #2c2e4a;
          color: #888;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }

        .step-indicator.active {
          background: #6a5af9;
          color: #fff;
        }

        /* Form */
        .input-group {
          margin-bottom: 24px;
        }

        .input-label {
          display: flex;
          align-items: center;
          font-size: 14px;
          margin-bottom: 6px;
          color: #ccc;
        }

        .label-icon {
          margin-right: 6px;
        }

        .input-field {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          border: 2px solid #2f314d;
          background: #101223;
          color: white;
          font-size: 14px;
          outline: none;
          transition: border 0.2s ease;
        }

        .input-field:focus {
          border-color: #6a5af9;
        }

        .input-error {
          border-color: #ff4d4f !important;
        }

        .input-field#message {
          min-height: 150px;
          resize: vertical;
        }

        /* Tombol */
        .btn {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          font-weight: bold;
          font-size: 16px;
          border: none;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .btn-primary {
          background: linear-gradient(to right, #6a5af9, #8f6eff);
          color: white;
        }

        .btn-primary:hover {
          opacity: 0.9;
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* Footer */
        .footer {
          text-align: center;
          margin-top: 24px;
          font-size: 13px;
          color: #888;
        }

        .footer p {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn-secondary {
          background-color: transparent;
          border: 2px solid #6a5af9;
          color: #6a5af9;
        }

        .btn-secondary:hover {
          background-color: rgba(106, 90, 249, 0.1);
        }

        .math-box {
          background: #0f1127;
          border: 2px solid #2f314d;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
          font-size: 20px;
          font-weight: bold;
          color: #ffffff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        #refresh-question {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #4ddbff;
          transition: transform 0.3s ease;
        }

        #refresh-question:hover {
          transform: rotate(180deg);
        }

        .donation-summary {
          background: #0d1025;
          border: 1px solid #2f314d;
          padding: 20px;
          border-radius: 10px;
          margin: 25px 0;
          color: #ddd;
        }

        .donation-summary h3 {
          font-size: 18px;
          color: #fff;
          margin-bottom: 15px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: nowrap;
          gap: 10px;
          font-size: 14px;
        }

        .summary-item span {
          white-space: nowrap;
          color: #ddd;
        }

        .summary-item strong {
          word-break: break-word;
          overflow-wrap: anywhere;
          max-width: 95%;
          font-weight: 600;
          font-size: 14px;
          color: #4ddbff;
        }

        /* Payment page styles */
        .payment-container {
          max-width: 480px;
          margin: auto;
          padding: 20px;
        }

        .payment-card {
          background: #181b34;
          padding: 20px;
          border-radius: 20px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          margin-top: 20px;
        }

        .countdown-timer {
          background: #ff4d4f;
          color: white;
          text-align: center;
          border-radius: 10px;
          padding: 10px;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 20px;
          animation: pulse 1s infinite alternate;
        }

        @keyframes pulse {
          from { transform: scale(1); }
          to { transform: scale(1.05); }
        }

        .payment-info {
          background: #0f1127;
          border: 1px solid #2f314d;
          border-radius: 10px;
          padding: 15px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .payment-info .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .payment-info .total {
          font-weight: bold;
          color: #4ddbff;
        }

        .qr-wrapper {
          text-align: center;
          margin-bottom: 20px;
        }

        .qr-image {
          width: 200px;
          height: 200px;
          border-radius: 12px;
          border: 4px solid #2f314d;
        }

        .action-buttons {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .payment-instruction {
          background: #0d1025;
          border: 1px solid #2f314d;
          padding: 15px;
          border-radius: 10px;
          font-size: 14px;
          color: #ddd;
        }

        .payment-instruction h3 {
          margin-bottom: 10px;
          color: #fff;
        }

        .payment-instruction ol {
          padding-left: 18px;
        }

        /* Animations */
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }

        .slide-up {
          animation: slideUp 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
