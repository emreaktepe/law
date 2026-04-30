'use strict';

/* ── Navbar: white on scroll + hamburger ── */
const navbar = document.getElementById('navbar');
const navHamburger = document.getElementById('navHamburger');
const navLinks = document.getElementById('navLinks');

function handleNavScroll() {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}

window.addEventListener('scroll', handleNavScroll, { passive: true });
handleNavScroll();

navHamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

/* ── Smooth scroll for all anchor links ── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-height')) || 70;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ── Intersection Observer fade-in ── */
const fadeEls = document.querySelectorAll('.fade-in');

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

fadeEls.forEach(el => observer.observe(el));

/* ── Contact form ── */
const contactForm = document.getElementById('contactForm');
const formMessage = document.getElementById('formMessage');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');

contactForm.addEventListener('submit', async e => {
  e.preventDefault();

  const adSoyad = document.getElementById('adSoyad').value.trim();
  const telefon = document.getElementById('telefon').value.trim();
  const hukukiKonu = document.getElementById('hukukiKonu').value;

  if (!adSoyad || !telefon || !hukukiKonu) {
    showMessage('Lütfen zorunlu alanları (*) doldurunuz.', 'error');
    return;
  }

  setLoading(true);

  const payload = {
    adSoyad,
    telefon,
    eposta: document.getElementById('eposta').value.trim(),
    hukukiKonu,
    aciklama: document.getElementById('aciklama').value.trim(),
  };

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showMessage(data.message, 'success');
      contactForm.reset();
    } else {
      showMessage(data.message || 'Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
    }
  } catch {
    showMessage('Bağlantı hatası. Lütfen daha sonra tekrar deneyin.', 'error');
  } finally {
    setLoading(false);
  }
});

function setLoading(state) {
  submitBtn.disabled = state;
  btnText.hidden = state;
  btnLoading.hidden = !state;
}

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = 'form-message ' + type;
  formMessage.hidden = false;
  formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── Loading bar cleanup ── */
window.addEventListener('load', () => {
  const bar = document.getElementById('loadingBar');
  if (bar) setTimeout(() => bar.remove(), 1400);
});
