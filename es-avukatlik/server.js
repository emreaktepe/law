require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/contact', (req, res) => {
  const { adSoyad, telefon, eposta, hukukiKonu, aciklama } = req.body;

  if (!adSoyad || !telefon || !hukukiKonu) {
    return res.status(400).json({
      success: false,
      message: 'Lütfen zorunlu alanları doldurunuz.'
    });
  }

  console.log('--- Yeni İletişim Talebi ---');
  console.log(`Ad Soyad    : ${adSoyad}`);
  console.log(`Telefon     : ${telefon}`);
  console.log(`E-posta     : ${eposta || '-'}`);
  console.log(`Hukuki Konu : ${hukukiKonu}`);
  console.log(`Açıklama    : ${aciklama || '-'}`);
  console.log('---------------------------');

  return res.json({
    success: true,
    message: 'Talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.'
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ES Avukatlık sunucusu çalışıyor: http://localhost:${PORT}`);
});
