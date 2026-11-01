import React from 'react';
import './katip.css';

export default function Katip({className = '', decorative = false}) {
  return <img className={`katip-mascot ${className}`} src={`${import.meta.env.BASE_URL}media/katip/katip-owl-welcome.png`} width="1024" height="1024" alt={decorative ? '' : 'Kâtip, gözlüklü ve fularlı sıcakkanlı baykuş yardımcınız'} decoding="async" />;
}
