import React, { useState, useEffect, useRef } from 'react';
import {
  Wheat, User, Shield, Users, Truck, Calendar, Wallet, Bell, MapPin,
  Sun, Moon, Globe, CloudSun, CloudMoon, LogOut, ArrowRight, CheckCircle2,
  AlertTriangle, DollarSign, Scale, Clock, MessageSquare, Send, Check, Plus, Search, HelpCircle, Download, FileText, Camera, Trash2, Edit2, X,
  Wind, CloudRain, CloudLightning, Droplets
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import confetti from 'canvas-confetti';
import { io } from 'socket.io-client';
import { jsPDF } from 'jspdf';
import {
  auth, provider, signInWithPopup, isFirebaseConfigured, simulateGoogleSignIn
} from './firebase';

// Global API Fetch Interceptor
const originalFetch = window.fetch;
window.fetch = async function (url, options) {
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  if (typeof url === 'string' && url.startsWith('/api/')) {
    url = `${apiBase}${url}`;
  }
  try {
    const response = await originalFetch(url, options);
    if (response.status === 401) {
      if (localStorage.getItem('fe_token')) {
        localStorage.removeItem('fe_token');
        window.location.reload();
      }
    }
    return response;
  } catch (error) {
    throw error;
  }
};


// ----------------------------------------------------
// LOCALIZATION DICTIONARY (Hindi / English)
// ----------------------------------------------------
const t = {
  en: {
    title: 'FarmEase',
    subtitle: 'Connecting Farmers, Workers, and Businesses',
    namaste: 'Namaste',
    welcome: 'Welcome to FarmEase',
    loading: 'Loading system state...',
    login: 'Login',
    signup: 'New Farmer Signup',
    forgot: 'Forgot Password / PIN?',
    phone: 'Phone Number',
    email: 'Email (Optional)',
    password: 'Password',
    pin: '6-Digit Worker PIN',
    name: 'Full Name',
    address: 'Address / Field Location',
    village: 'Village Name',
    upi: 'UPI ID (Optional)',
    role: 'Select Role',
    submit: 'Submit',
    back: 'Back to Login',
    farmer: 'Farmer',
    worker: 'Field Worker',
    employee: 'Office Operator',
    supervisor: 'Supervisor',
    admin: 'Administrator',
    offline: 'Offline Mode: Actions cached. Autosyncing on reconnect...',
    dashboard: 'Dashboard',
    prices: 'Live Crop Prices',
    weather: 'Live Weather',
    bookPickup: 'Book Crop Pickup',
    myPickups: 'My Pickup Requests',
    receipts: 'Digital Weight Slips',
    payments: 'Farmer Ledger Summary',
    transactions: 'Transaction History',
    netProfit: 'Net Profit',
    totalBought: 'Total Procured',
    totalSold: 'Total Outward Sold',
    expenses: 'Operational Costs',
    priceBoard: 'Pricing Board & AI Suggestions',
    activeStock: 'Real-time Stock Levels',
    logSale: 'Log Outward Sale',
    staffControl: 'Staff Management',
    vehicles: 'Fleet & Fuel Expenses',
    broadcast: 'Global Push Alerts',
    helpline: 'Admin Helpline Chat',
    punchCard: 'Attendance Punch',
    tasks: 'Assigned Duties',
    location: 'Location Sharing',
    earnings: 'Earnings Ledger',
    dues: 'Outstanding Dues / Advances',
    whatsapp: 'WhatsApp Support Fallback',
    search: 'Search by name/phone/village...',
    rate: 'Rate per Quintal (₹)',
    payout: 'Total Expected Payout (₹)',
    processProcurement: 'Generate Weighing Receipt',
    addCosts: 'Log Procurement Expenses',
    priceTrend: 'Market Pricing Trends',
    aiSuggested: 'AI Recommended Buying Price',
    status: 'Status',
    date: 'Date',
    quantity: 'Quantity'
  },
  hi: {
    title: 'फ़ार्मईज़ (FarmEase)',
    subtitle: 'किसानों, श्रमिकों और व्यवसायों को जोड़ना',
    namaste: 'नमस्ते',
    welcome: 'फ़ार्मईज़ में आपका स्वागत है',
    loading: 'सिस्टम लोड हो रहा है...',
    login: 'लॉगिन करें',
    signup: 'नया किसान पंजीकरण',
    forgot: 'पासवर्ड / पिन भूल गए?',
    phone: 'फ़ोन नंबर',
    email: 'ईमेल (वैकल्पिक)',
    password: 'पासवर्ड',
    pin: '6-अंकीय श्रमिक पिन',
    name: 'पूरा नाम',
    address: 'पता / खेत का स्थान',
    village: 'गाँव का नाम',
    upi: 'यूपीआई आईडी (वैकल्पिक)',
    role: 'भूमिका चुनें',
    submit: 'जमा करें',
    back: 'लॉगिन पर वापस जाएं',
    farmer: 'किसान',
    worker: 'खेत मजदूर (श्रमिक)',
    employee: 'कार्यालय संचालक',
    supervisor: 'पर्यवेक्षक (Supervisor)',
    admin: 'प्रशासक (एडमिन)',
    offline: 'ऑफ़लाइन मोड: इनपुट कैश्ड हैं। दोबारा जुड़ने पर सिंक होगा...',
    dashboard: 'डैशबोर्ड',
    prices: 'फसल की लाइव दरें',
    weather: 'मौसम की जानकारी',
    bookPickup: 'फसल पिकअप बुक करें',
    myPickups: 'पिकअप अनुरोध सूची',
    receipts: 'डिजिटल वजन पर्ची',
    payments: 'भुगतान और बहीखाता',
    transactions: 'लेनदेन इतिहास',
    netProfit: 'शुद्ध लाभ',
    totalBought: 'कुल खरीद (क्विंटल)',
    totalSold: 'कुल बिक्री (क्विंटल)',
    expenses: 'परिचालन लागत',
    priceBoard: 'मूल्य बोर्ड और AI सुझाव',
    activeStock: 'वेयरहाउस स्टॉक स्तर',
    logSale: 'बाहरी बिक्री दर्ज करें',
    staffControl: 'स्टाफ प्रबंधन',
    vehicles: 'वाहन और ईंधन खर्च',
    broadcast: 'वैश्विक पुश अलर्ट',
    helpline: 'एडमिन हेल्पलाइन चैट',
    punchCard: 'उपस्थिति पंच',
    tasks: 'सौंपे गए कार्य',
    location: 'स्थान साझाकरण (GPS)',
    earnings: 'दैनिक/मासिक कमाई',
    dues: 'लंबित बकाया / अग्रिम',
    whatsapp: 'व्हाट्सएप सहायता संपर्क',
    search: 'नाम/फ़ोन/गाँव से खोजें...',
    rate: 'दर प्रति क्विंटल (₹)',
    payout: 'कुल अपेक्षित भुगतान (₹)',
    processProcurement: 'वजन रसीद बनाएं',
    addCosts: 'अतिरिक्त खर्च दर्ज करें',
    priceTrend: 'बाजार मूल्य रुझान',
    aiSuggested: 'AI अनुशंसित खरीद दर',
    status: 'स्थिति',
    date: 'तारीख',
    quantity: 'मात्रा'
  }
};

let triggerToastGlobal = () => { };

const formatCurrency = (value) => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Utility to format Indian vehicle registration numbers dynamically
const formatIndianVehicleNumber = (raw) => {
  if (!raw) return '';
  let clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (/^[0-9]{2}BH/.test(clean)) {
    let result = clean.slice(0, 2);
    let remaining = clean.slice(2);
    if (remaining.startsWith('BH')) {
      result += '-BH';
      remaining = remaining.slice(2);
    } else if (remaining.length > 0) {
      result += '-' + remaining.slice(0, 2);
      remaining = remaining.slice(2);
    }

    let digits = remaining.replace(/[^0-9]/g, '').slice(0, 4);
    if (digits) {
      result += '-' + digits;
      let alpha = remaining.slice(digits.length).replace(/[^A-Z]/g, '').slice(0, 2);
      if (alpha) {
        result += '-' + alpha;
      }
    } else if (remaining.length > 0) {
      result += '-' + remaining;
    }
    return result;
  }

  let result = '';
  let state = clean.slice(0, 2).replace(/[^A-Z]/g, '');
  if (state) {
    result += state;
    let afterState = clean.slice(state.length);

    let rtoMatch = afterState.match(/^[0-9]+/);
    let rto = rtoMatch ? rtoMatch[0].slice(0, 2) : '';
    if (rto) {
      result += '-' + rto;
      let afterRto = afterState.slice(rto.length);

      let seriesMatch = afterRto.match(/^[A-Z]+/);
      let series = seriesMatch ? seriesMatch[0].slice(0, 3) : '';
      if (series) {
        result += '-' + series;
        let afterSeries = afterRto.slice(series.length);

        let numMatch = afterSeries.match(/^[0-9]+/);
        let num = numMatch ? numMatch[0].slice(0, 4) : '';
        if (num) {
          result += '-' + num;
        }
      } else {
        let numMatch = afterRto.match(/^[0-9]+/);
        let num = numMatch ? numMatch[0].slice(0, 4) : '';
        if (num) {
          result += '-' + num;
        }
      }
    }
  } else {
    result = clean;
  }
  return result;
};

// HTML5 Web Audio API Synthesizer - Crisp, zero-dependency musical beep chime
const playBeepSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note - premium alert pitch
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    console.warn('Audio play failed:', err);
  }
};

const downloadReceiptPDF = (slip) => {
  const doc = new jsPDF();

  // Page Border Frame
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, 190, 277);

  // Top header banner
  doc.setFillColor(27, 67, 50);
  doc.rect(10, 10, 190, 25, 'F');

  // Branding text
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("FARMEASE", 15, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("CONNECTING FARMERS, WORKERS & BUSINESSES", 15, 28);

  // Document Title inside banner
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DIGITAL PROCUREMENT SLIP", 195, 26, { align: "right" });

  // Metadata Box (Y: 42, H: 16)
  doc.setFillColor(245, 247, 245);
  doc.rect(15, 42, 180, 16, 'F');
  doc.setDrawColor(220, 225, 220);
  doc.rect(15, 42, 180, 16);

  // Metadata Values
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("SLIP NUMBER:", 20, 52);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(String(slip.slip_id), 47, 52);

  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "bold");
  doc.text("DATE GENERATED:", 105, 52);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(new Date(slip.created_at || Date.now()).toLocaleString(), 140, 52);

  // Entity details cards (Farmer vs logistics) (Y: 65, H: 36)
  // Card 1: Farmer Details
  doc.setFillColor(250, 250, 250);
  doc.rect(15, 65, 87, 36, 'F');
  doc.setDrawColor(230, 230, 230);
  doc.rect(15, 65, 87, 36);

  doc.setFillColor(27, 67, 50);
  doc.rect(15, 65, 87, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("FARMER DETAILS", 20, 70);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("Name:", 20, 79);
  doc.text("Village:", 20, 86);
  doc.text("Phone:", 20, 93);

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.text(String(slip.farmer_name || 'N/A'), 40, 79);
  doc.text(String(slip.farmer_village || 'N/A'), 40, 86);
  doc.text(String(slip.farmer_phone || 'N/A'), 40, 93);

  // Card 2: Logistics Details
  doc.setFillColor(250, 250, 250);
  doc.rect(108, 65, 87, 36, 'F');
  doc.setDrawColor(230, 230, 230);
  doc.rect(108, 65, 87, 36);

  doc.setFillColor(27, 67, 50);
  doc.rect(108, 65, 87, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("LOGISTICS & MANDI DETAILS", 113, 70);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("Weighed By:", 113, 79);
  doc.text("Mandi Loc:", 113, 86);
  doc.text("Status:", 113, 93);

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.text(String(slip.weighed_by_name || 'Mandi Operator'), 138, 79);
  doc.text(String(slip.farmer_village || 'Central Warehouse'), 138, 86);
  doc.setTextColor(27, 67, 50);
  doc.setFont("helvetica", "bold");
  doc.text("VERIFIED & APPROVED", 138, 93);

  // Table header & rows
  doc.setTextColor(27, 67, 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PROCUREMENT METRICS", 15, 114);

  doc.setFillColor(235, 245, 240);
  doc.rect(15, 118, 180, 8, 'F');
  doc.setDrawColor(200, 220, 210);
  doc.line(15, 118, 195, 118);
  doc.line(15, 126, 195, 126);

  doc.setTextColor(27, 67, 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Crop Description", 18, 123.5);
  doc.text("Bags Count", 60, 123.5, { align: "right" });
  doc.text("Weight (Qtl)", 90, 123.5, { align: "right" });
  doc.text("Rate / Qtl", 125, 123.5, { align: "right" });
  doc.text("Gross Value", 160, 123.5, { align: "right" });
  doc.text("Deductions", 192, 123.5, { align: "right" });

  // Detail Row Values
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.text(String(slip.crop_name), 18, 133);
  doc.text(`${slip.bag_count} bags`, 60, 133, { align: "right" });

  doc.text(Number(slip.quintals || 0).toFixed(2), 90, 133, { align: "right" });
  doc.text(`INR ${Number(slip.rate_per_quintal || 0).toFixed(2)}`, 125, 133, { align: "right" });

  const grossVal = Number(slip.quintals || 0) * Number(slip.rate_per_quintal || 0);
  doc.text(`INR ${grossVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, 133, { align: "right" });

  doc.setTextColor(180, 50, 50); // elegant red for deductions
  doc.text(`-INR ${Number(slip.deductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, 133, { align: "right" });
  doc.setTextColor(30, 30, 30); // reset color

  // Underline table row
  doc.setDrawColor(220, 220, 220);
  doc.line(15, 138, 195, 138);

  // Financial summary & scale image (Y: 145)
  // Right Col: Payout Highlight Box
  doc.setFillColor(240, 248, 243);
  doc.rect(108, 145, 87, 24, 'F');
  doc.setDrawColor(27, 67, 50);
  doc.rect(108, 145, 87, 24);

  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("TOTAL EXPECTED PAYOUT", 113, 151);

  doc.setTextColor(27, 67, 50);
  doc.setFontSize(13.5);
  doc.setFont("helvetica", "bold");
  doc.text(`INR ${Number(slip.total_payout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 113, 162);

  // Left Col: Image Attachment frame or placeholder
  if (slip.weight_image) {
    try {
      doc.setDrawColor(220, 220, 220);
      doc.rect(15, 145, 80, 50);
      doc.addImage(slip.weight_image, 'PNG', 16, 146, 78, 48);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.text("Verified Scale Weight Certificate Scale Snapshot", 15, 199);
    } catch (err) {
      console.warn('PDF image rendering error:', err);
    }
  } else {
    // Elegant placeholder frame
    doc.setDrawColor(230, 230, 230);
    doc.rect(15, 145, 80, 50);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("No scale certificate image uploaded", 55, 172, { align: "center" });
  }

  // Signatures section (Y: 235)
  doc.setDrawColor(180, 180, 180);
  doc.line(25, 245, 80, 245);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Farmer's Signature", 52.5, 250, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("I hereby certify the weights & bags count details", 52.5, 254, { align: "center" });

  doc.line(130, 245, 185, 245);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Authorized Signatory", 157.5, 250, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Weighed & Approved digitally via Mandi Gate", 157.5, 254, { align: "center" });

  // Footer (Y: 270)
  doc.setDrawColor(230, 230, 230);
  doc.line(15, 268, 195, 268);

  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Thank you for partnering with FarmEase. For support call +91 1800-FARM-EASE or email help@farmease.org.", 105, 273, { align: "center" });
  doc.text("This document is a legally valid digital weighing slip generated by FarmEase Mandi Logistics.", 105, 277, { align: "center" });

  doc.save(`farmease-slip-${slip.slip_id}.pdf`);
  triggerToastGlobal('PDF Downloaded 📄', `Slip ${slip.slip_id} saved to your device.`);
};

const downloadPaymentReceiptPDF = (receipt) => {
  const doc = new jsPDF();
  const breakdownRows = receipt?.breakdown?.byMode || [];
  const isSettlement = (receipt?.receipt_type || '').toLowerCase() === 'settlement';

  // Page Border Frame
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, 190, 277);

  // Top header banner
  doc.setFillColor(22, 122, 80);
  doc.rect(10, 10, 190, 25, 'F');

  // Branding text
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("FARMEASE", 15, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("CONNECTING FARMERS, WORKERS & BUSINESSES", 15, 28);

  // Document Title inside banner
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(isSettlement ? "SETTLEMENT RECEIPT" : "PAYMENT RECEIPT", 195, 26, { align: "right" });

  // Metadata Box (Y: 42, H: 16)
  doc.setFillColor(245, 247, 245);
  doc.rect(15, 42, 180, 16, 'F');
  doc.setDrawColor(220, 225, 220);
  doc.rect(15, 42, 180, 16);

  // Metadata Values
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RECEIPT NO:", 20, 52);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(String(receipt.receipt_no), 45, 52);

  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "bold");
  doc.text("TRANSACTION DATE:", 105, 52);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(new Date(receipt.created_at).toLocaleString(), 145, 52);

  // Entity details cards (Farmer vs Transaction) (Y: 65, H: 36)
  // Card 1: Farmer Details
  doc.setFillColor(250, 250, 250);
  doc.rect(15, 65, 87, 36, 'F');
  doc.setDrawColor(230, 230, 230);
  doc.rect(15, 65, 87, 36);

  doc.setFillColor(22, 122, 80);
  doc.rect(15, 65, 87, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("FARMER DETAILS", 20, 70);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("Name:", 20, 79);
  doc.text("Village:", 20, 86);
  doc.text("Phone:", 20, 93);

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.text(String(receipt.farmer_name || 'Farmer'), 40, 79);
  doc.text(String(receipt.farmer_village || '-'), 40, 86);
  doc.text(String(receipt.farmer_phone || '-'), 40, 93);

  // Card 2: Transaction Details
  doc.setFillColor(250, 250, 250);
  doc.rect(108, 65, 87, 36, 'F');
  doc.setDrawColor(230, 230, 230);
  doc.rect(108, 65, 87, 36);

  doc.setFillColor(22, 122, 80);
  doc.rect(108, 65, 87, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("TRANSACTION METADATA", 113, 70);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("Slip Ref ID:", 113, 79);
  doc.text("Payment Mode:", 113, 86);
  doc.text("Issued By:", 113, 93);

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.text(String(receipt.slip_id || '-'), 143, 79);
  doc.setFont("helvetica", "bold");
  doc.text(String(receipt.payment_mode || '-').toUpperCase(), 143, 86);
  doc.setFont("helvetica", "normal");
  doc.text(String(receipt.issued_by_name || 'FarmEase Admin'), 143, 93);

  // Table header & row (Y: 114)
  doc.setTextColor(22, 122, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PAYMENT & LEDGER SUMMARY", 15, 114);

  doc.setFillColor(235, 245, 240);
  doc.rect(15, 118, 180, 8, 'F');
  doc.setDrawColor(200, 220, 210);
  doc.line(15, 118, 195, 118);
  doc.line(15, 126, 195, 126);

  doc.setTextColor(22, 122, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Crop Description", 18, 123.5);
  doc.text("Quantity", 65, 123.5, { align: "right" });
  doc.text("Total Value", 100, 123.5, { align: "right" });
  doc.text("Amount Paid Now", 140, 123.5, { align: "right" });
  doc.text("Cumulative Paid", 185, 123.5, { align: "right" });

  // Table Values
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.text(String(receipt.crop_name || 'Crop Procurement'), 18, 131);
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text(`Rate: ₹${Number(receipt.rate_per_quintal || 0).toLocaleString('en-IN')}/Qtl | Deductions: ₹${Number(receipt.deductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 18, 135);
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(`${Number(receipt.quintals || 0).toFixed(2)} Qtl`, 65, 133, { align: "right" });
  doc.text(formatCurrency(receipt.total_amount), 100, 133, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 122, 80);
  doc.text(formatCurrency(receipt.amount_paid), 140, 133, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(formatCurrency(receipt.total_paid_after), 185, 133, { align: "right" });

  // Underline table row
  doc.setDrawColor(220, 220, 220);
  doc.line(15, 138, 195, 138);

  // Breakdown & Outstanding (Y: 145, H: 45)
  // Left side: Mode-wise totals
  if (breakdownRows.length > 0) {
    doc.setFillColor(250, 250, 250);
    doc.rect(15, 145, 87, 45, 'F');
    doc.setDrawColor(230, 230, 230);
    doc.rect(15, 145, 87, 45);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text("MODE-WISE PAYMENT TOTALS", 20, 152);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    let rowY = 160;
    breakdownRows.forEach((row) => {
      doc.text(`${String(row.payment_mode || '').toUpperCase()}:`, 20, rowY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(`${formatCurrency(row.total)} (${row.count} txns)`, 50, rowY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      rowY += 6;
    });
  } else {
    doc.setFillColor(250, 250, 250);
    doc.rect(15, 145, 87, 45, 'F');
    doc.setDrawColor(230, 230, 230);
    doc.rect(15, 145, 87, 45);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("This receipt details the specific ledger update,", 20, 158);
    doc.text("reflecting payments processed directly for the", 20, 164);
    doc.text("linked weighing slip. All transactions are logged", 20, 170);
    doc.text("safely in the FarmEase accounts database.", 20, 176);
  }

  // Right side: Remaining Due highlight box
  const remainingDue = Number(receipt.due_after || 0);
  const isCleared = remainingDue <= 0;

  if (isCleared) {
    doc.setFillColor(240, 248, 243); // Soft green background
    doc.setDrawColor(22, 122, 80); // Border green
  } else {
    doc.setFillColor(254, 242, 242); // Soft red background
    doc.setDrawColor(220, 38, 38); // Border red
  }
  doc.rect(108, 145, 87, 24, 'F');
  doc.rect(108, 145, 87, 24);

  doc.setTextColor(isCleared ? 22 : 180, isCleared ? 122 : 50, isCleared ? 80 : 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("OUTSTANDING LEDGER BALANCE", 113, 151);

  doc.setFontSize(13.5);
  if (isCleared) {
    doc.text("₹0.00 (SETTLED)", 113, 162);
  } else {
    doc.text(formatCurrency(remainingDue), 113, 162);
  }

  // Signatures section (Y: 235)
  doc.setDrawColor(180, 180, 180);
  doc.line(25, 245, 80, 245);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Farmer's Signature", 52.5, 250, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("I acknowledge receipt of the payment amount above.", 52.5, 254, { align: "center" });

  doc.line(130, 245, 185, 245);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Authorized Representative", 157.5, 250, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Payment Disbursed & Signed Digitally", 157.5, 254, { align: "center" });

  // Footer (Y: 270)
  doc.setDrawColor(230, 230, 230);
  doc.line(15, 268, 195, 268);

  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Thank you for partnering with FarmEase. For support call +91 1800-FARM-EASE or email help@farmease.org.", 105, 273, { align: "center" });
  doc.text("This document is a legally valid digital transaction receipt generated by FarmEase Accounts.", 105, 277, { align: "center" });

  doc.save(`farmease-payment-${receipt.receipt_no}.pdf`);
  triggerToastGlobal('Payment Receipt Downloaded', `${receipt.receipt_no} saved to your device.`);
};

// ----------------------------------------------------
// LOCALIZED WEATHER ADVISORY WITH GPS PERMISSION
// ----------------------------------------------------
function WeatherAdvisory({ village }) {
  const [coords, setCoords] = useState(null);
  const [requestingGps, setRequestingGps] = useState(false);

  const hour = new Date().getHours();
  const isNight = hour >= 19 || hour < 6;

  const [weather, setWeather] = useState({
    temp: isNight ? 22 : 32,
    humidity: isNight ? 65 : 35,
    condition: isNight ? 'Clear Cool Night' : 'Dry & Sunny',
    wind: '10 km/h',
    advisory: isNight
      ? 'Night Operations Advisory: Cool dry night is ideal for grain moisture stabilization. Ensure weighing scale yards are well lit for ongoing truck arrivals.'
      : 'Harvest Advisory: Dry, sunny weather is ideal for wheat collection. Keep grain moisture below 12% for safe warehousing and peak payout.',
    code: 0
  });

  const fetchWeather = async (lat, lng) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`);
      if (res.ok) {
        const data = await res.json();
        const current = data.current;
        if (current) {
          const code = current.weather_code;
          const currentHour = new Date().getHours();
          const currentIsNight = currentHour >= 19 || currentHour < 6;

          let cond = currentIsNight ? 'Dry & Cool Night' : 'Dry & Sunny';
          let adv = currentIsNight
            ? 'Night Operations Advisory: Cool dry night is ideal for grain moisture stabilization. Ensure weighing scale yards are well lit for ongoing truck arrivals.'
            : 'Harvest Advisory: Dry, sunny weather is ideal for wheat collection. Keep grain moisture below 12% for safe warehousing and peak payout.';

          if (code === 0 || code === 1) {
            cond = currentIsNight ? 'Clear Cool Night' : 'Clear & Sunny';
            adv = currentIsNight
              ? 'Night Operations Advisory: Excellent clear cool night sky! Ideal for ventilation and cooling of stock piles. Great for secure yard operations and night-shift weighing.'
              : 'Harvest Advisory: Excellent clear sky conditions! Ideal for dry grain collection. Ensure moisture content is kept below 12% before storage.';
          } else if (code === 2 || code === 3 || code === 45 || code === 48) {
            cond = currentIsNight ? 'Overcast Night' : 'Overcast & Cloudy';
            adv = currentIsNight
              ? 'Night Advisory: Overcast skies tonight. Check storage ventilation systems. Ideal for office operations and night logistics coordination.'
              : 'Overcast Advisory: Humid and cloudy weather. Keep an eye on storage ventilation. Excellent time for logistics planning and weighing operations under yard shelter.';
          } else if (code >= 51 && code <= 82) {
            cond = currentIsNight ? 'Rainy Night' : 'Precipitation / Rain';
            adv = currentIsNight
              ? 'ALERT: Rainy night! Ensure all active outdoor grain piles are completely sheeted and secure under yard cover. Avoid night transportation in open trucks.'
              : 'ALERT: Precipitation detected! Protect active crop heaps under thick tarpaulins immediately. Avoid weighing in open yards. Delay grain transit till rain clears to prevent damage.';
          } else if (code >= 95) {
            cond = currentIsNight ? 'Midnight Thunderstorm' : 'Thunderstorm Active';
            adv = 'CRITICAL ALERT: Thunderstorms/Lightning active! Halt all outdoor logistics and field transport operations immediately. Keep vehicles under secure shelter.';
          }

          setWeather({
            temp: Math.round(current.temperature_2m),
            humidity: current.relative_humidity_2m,
            condition: cond,
            wind: `${current.wind_speed_10m} km/h`,
            advisory: adv,
            code: code
          });
        }
      }
    } catch (err) {
      console.warn("Failed to fetch weather:", err);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = () => {
    if (navigator.geolocation) {
      setRequestingGps(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(4);
          const lng = position.coords.longitude.toFixed(4);
          setCoords({ lat, lng });
          setRequestingGps(false);
          fetchWeather(lat, lng);
        },
        (error) => {
          console.warn("Location access denied or error:", error);
          setRequestingGps(false);
          // Fallback to default New Delhi coordinates
          const defaultLat = 28.19117;
          const defaultLng = 76.16463;
          setCoords(null);
          fetchWeather(defaultLat, defaultLng);
        }
      );
    } else {
      fetchWeather(28.19117, 76.16463);
    }
  };

  // Select icon based on Open-Meteo weather code
  const renderWeatherIcon = () => {
    const code = weather.code;
    const currentHour = new Date().getHours();
    const currentIsNight = currentHour >= 19 || currentHour < 6;

    if (code === 0 || code === 1) {
      if (currentIsNight) {
        return <Moon className="text-indigo-300 animate-pulse" size={32} />;
      }
      return <Sun className="animate-spin-slow text-amber-400" size={32} />;
    } else if (code === 2 || code === 3 || code === 45 || code === 48) {
      if (currentIsNight) {
        return <CloudMoon className="text-indigo-200" size={32} />;
      }
      return <CloudSun className="text-slate-300" size={32} />;
    } else if (code >= 51 && code <= 82) {
      return <CloudRain className="text-blue-400 animate-pulse" size={32} />;
    } else {
      return <CloudLightning className="text-yellow-500 animate-bounce" size={32} />;
    }
  };

  return (
    <div className={`glass-panel p-5 rounded-2xl border-l-4 ${isNight ? 'border-l-indigo-500' : 'border-l-amber-500'} mb-6 bg-gradient-to-r ${isNight ? 'from-indigo-950/40 via-slate-900/90 to-slate-950/80' : 'from-slate-900/80 via-slate-900/90 to-slate-950/80'} relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl`}>
      <div className={`absolute top-0 right-0 w-32 h-32 ${isNight ? 'bg-indigo-500/10' : 'bg-amber-500/10'} rounded-full blur-3xl pointer-events-none`}></div>
      <div className="flex items-center gap-4">
        <div className={`p-3 ${isNight ? 'bg-indigo-950/50 border border-indigo-900/50 text-indigo-300' : 'bg-amber-950/50 border border-amber-900/50 text-amber-400'} rounded-2xl flex items-center justify-center`}>
          {renderWeatherIcon()}
        </div>
        <div>
          <span className={`text-[10px] font-bold tracking-widest ${isNight ? 'text-indigo-300' : 'text-amber-400'} uppercase flex items-center gap-1.5`}>
            <MapPin size={12} />
            {coords ? 'GPS Hyperlocal Weather' : `Weather Advisory (${village || 'Kothal Kalan'})`}
          </span>
          <h4 className="font-display font-extrabold text-base text-white mt-0.5">{weather.temp}°C | {weather.condition}</h4>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {weather.advisory}
          </p>
          {!coords && (
            <button
              onClick={requestLocation}
              className={`text-[9px] ${isNight ? 'text-indigo-400 hover:text-indigo-300' : 'text-amber-400 hover:text-amber-300'} font-bold uppercase tracking-wider mt-2 block underline cursor-pointer`}
            >
              {requestingGps ? 'Accessing location coordinates...' : 'Enable GPS for Hyperlocal Weather'}
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-4 items-center bg-slate-950/40 px-4 py-2 rounded-xl border border-slate-800 text-[10px] text-slate-400 whitespace-nowrap self-stretch md:self-auto justify-around">
        <div className="flex flex-col items-center">
          <span className="block font-bold text-slate-500 uppercase flex items-center gap-1"><Droplets size={10} /> HUMIDITY</span>
          <span className="font-bold text-white mt-0.5 block">{weather.humidity}%</span>
        </div>
        <div className="border-l border-slate-800 h-6"></div>
        <div className="flex flex-col items-center">
          <span className="block font-bold text-slate-500 uppercase flex items-center gap-1"><Wind size={10} /> WIND</span>
          <span className="font-bold text-white mt-0.5 block">{weather.wind}</span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// IN-APP HELPLINE SUPPORT DESK
// ----------------------------------------------------
function HelplineChat({ token, peerId, translate, user }) {
  const [messages, setMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');

  const prevMessagesCountRef = useRef(0);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 3000);
    return () => clearInterval(interval);
  }, [peerId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/chat/history/${peerId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const history = await res.json();
        setMessages(history);
        if (history.length > prevMessagesCountRef.current) {
          const lastMsg = history[history.length - 1];
          if (lastMsg && lastMsg.sender_id !== user.id && prevMessagesCountRef.current > 0) {
            playBeepSound();
          }
        }
        prevMessagesCountRef.current = history.length;
      }
    } catch (e) { }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ receiver_id: peerId, message: typedMessage })
      });
      if (res.ok) {
        setTypedMessage('');
        fetchHistory();
      }
    } catch (e) { }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      const res = await fetch(`/api/chat/message/${msgId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchHistory();
      } else {
        const data = await res.json();
        triggerToastGlobal('Action Failed', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  const handleClearConversation = async () => {
    if (!confirm('Are you sure you want to clear your entire chat history with the helpline?')) return;
    try {
      const res = await fetch(`/api/chat/conversation/${peerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        triggerToastGlobal('Chat Cleared 🗑️', 'Helpline chat history cleared.');
        fetchHistory();
      } else {
        const data = await res.json();
        triggerToastGlobal('Action Failed', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  return (
    <div className="glass-panel bg-slate-900/40 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between h-[55vh] shadow-lg">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-white">AgriTech Helpline Support Desk</h4>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearConversation}
            className="text-[10px] bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-bold px-2 py-1 rounded-lg transition cursor-pointer select-none flex items-center gap-1"
          >
            <Trash2 size={10} />
            Clear Chat
          </button>
        )}
      </div>
      <div className="flex-grow overflow-y-auto space-y-3 p-2">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-12">No helpline messages yet. Drop us a text to start.</p>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={idx} className={`flex items-center gap-1.5 group ${isMe ? 'justify-end' : 'justify-start'}`}>
                {isMe && msg.id && (
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="opacity-25 hover:opacity-100 sm:opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition cursor-pointer select-none self-center"
                    title="Delete message"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <div className={`p-3 rounded-2xl max-w-xs text-xs leading-relaxed ${isMe
                    ? 'helpline-bubble-me rounded-br-none shadow-sm'
                    : 'helpline-bubble-peer rounded-bl-none shadow-sm'
                  }`}>
                  {!isMe && <span className="block font-bold text-[9px] text-emerald-600 dark:text-emerald-400 uppercase mb-1">{msg.sender_name}</span>}
                  <p>{msg.message}</p>
                  <span className={`block text-[8px] text-right mt-1 ${isMe ? 'text-emerald-800/80 dark:text-rose-200' : 'text-slate-500 dark:text-slate-400'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {!isMe && msg.id && (
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="opacity-25 hover:opacity-100 sm:opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition cursor-pointer select-none self-center"
                    title="Delete message"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-2">
        <input
          type="text"
          value={typedMessage}
          onChange={e => setTypedMessage(e.target.value)}
          placeholder="Ask Helpline anything..."
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500"
        />
        <button type="submit" className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition cursor-pointer">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

// ----------------------------------------------------
// DYNAMIC PROFILE EDITOR FOR FARMERS & STAFF
// ----------------------------------------------------
function ProfileEditor({ token, setToken, user, onUserUpdate }) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [address, setAddress] = useState(user.address || '');
  const [village, setVillage] = useState(user.village || '');
  const [upiId, setUpiId] = useState(user.upi_id || '');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState(user.pin || '');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
    setAddress(user.address || '');
    setVillage(user.village || '');
    setUpiId(user.upi_id || '');
    setPin(user.pin || '');
    setPassword('');
  }, [user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name,
      email,
      address,
      village,
      upi_id: upiId
    };

    if (password) payload.password = password;
    if (pin) payload.pin = pin;

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Profile Updated! ✅', 'Your profile details have been saved.');
        confetti({ particleCount: 30 });
        if (data.token) {
          localStorage.setItem('fe_token', data.token);
          if (setToken) setToken(data.token);
        }
        if (onUserUpdate) onUserUpdate(data.user);
        setPassword('');
        setIsEditing(false);
      } else {
        triggerToastGlobal('Update Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Failed to update profile.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="glass-panel p-6 rounded-2xl max-w-xl border border-slate-800 bg-slate-900/40 text-xs">
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-display font-extrabold text-lg text-white">Personal Profile</h3>
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">Role: {user.role}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-xl cursor-pointer transition select-none flex items-center gap-1.5"
          >
            <Edit2 size={13} />
            Edit Profile
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-300">
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Full Name</span>
            <span className="text-white font-semibold text-sm">{name || 'N/A'}</span>
          </div>
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Email Address</span>
            <span className="text-white font-semibold text-sm">{email || 'N/A'}</span>
          </div>
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Village Name</span>
            <span className="text-white font-semibold text-sm">{village || 'N/A'}</span>
          </div>
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">UPI ID</span>
            <span className="text-white font-semibold text-sm">{upiId || 'N/A'}</span>
          </div>
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 sm:col-span-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Address Location</span>
            <span className="text-white font-semibold text-sm leading-relaxed">{address || 'N/A'}</span>
          </div>
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Security PIN</span>
            <span className="text-white font-semibold text-sm font-mono">******</span>
          </div>
          <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Phone Number</span>
            <span className="text-white font-semibold text-sm font-mono">{user.phone}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 rounded-2xl max-w-xl border border-slate-800 bg-slate-900/40">
      <h3 className="font-display font-extrabold text-lg text-white mb-4">Edit Personal Profile</h3>
      <form onSubmit={handleUpdate} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">Full Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" required />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">Village Name</label>
            <input type="text" value={village} onChange={e => setVillage(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">UPI ID</label>
            <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-300 mb-1.5">Address Location</label>
          <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" rows={2} />
        </div>

        <div className="border-t border-slate-800 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">Change PIN (4-6 digits)</label>
            <input type="password" value={pin} maxLength={6} onChange={e => setPin(e.target.value)} placeholder="Enter new PIN" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">Change Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter new password" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => {
            setName(user.name || '');
            setEmail(user.email || '');
            setAddress(user.address || '');
            setVillage(user.village || '');
            setUpiId(user.upi_id || '');
            setPin(user.pin || '');
            setPassword('');
            setIsEditing(false);
          }} className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-lg mt-2 cursor-pointer transition select-none">
            Cancel
          </button>
          <button type="submit" className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg mt-2 cursor-pointer transition select-none" disabled={loading}>
            {loading ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ----------------------------------------------------
// MAIN APPLICATION
// ----------------------------------------------------
export default function App() {
  const [lang, setLang] = useState('english');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('fe_dark_mode') === 'true');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState(null);
  const [splash, setSplash] = useState(true);
  const [authView, setAuthView] = useState('login');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('fe_token') || null);
  const socketRef = useRef(null);

  // Cross-system notifications states
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const prevUnreadIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);

  const fetchNotifications = async () => {
    if (!localStorage.getItem('fe_token')) return;
    try {
      const res = await fetch('/api/notifications', { headers: { 'Authorization': `Bearer ${localStorage.getItem('fe_token')}` } });
      if (res.ok) {
        const list = await res.json();
        setNotifications(list);
        setUnreadCount(list.filter(n => !n.is_read).length);
      }
    } catch (e) { }
  };

  const markAllNotificationsAsRead = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications/mark-read', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNotifications();
        triggerToast('Notifications Cleared ✅', 'All items marked as read.');
      }
    } catch (e) { }
  };

  const markSingleAsRead = async (id) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (e) { }
  };

  useEffect(() => {
    if (token) {
      fetchNotifications();
      const poll = setInterval(fetchNotifications, 4000);
      return () => clearInterval(poll);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [token]);

  useEffect(() => {
    const unread = notifications.filter(n => !n.is_read);
    const unreadIds = new Set(unread.map(n => n.id));

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevUnreadIdsRef.current = unreadIds;
      return;
    }

    // Find if there are any unread IDs in this list that were not in the previous unread list
    const brandNewUnread = unread.filter(n => !prevUnreadIdsRef.current.has(n.id));

    if (brandNewUnread.length > 0) {
      brandNewUnread.forEach(newest => {
        triggerToast(newest.title, newest.message);
      });
      playBeepSound(); // Play notification chime!
    }

    prevUnreadIdsRef.current = unreadIds;
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('fe_dark_mode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  const translate = (key) => {
    const code = lang === 'hindi' ? 'hi' : 'en';
    return t[code][key] || key;
  };

  const triggerToast = (title, message, type = 'success') => {
    setToast({ title, message, type });
    playBeepSound();
    setTimeout(() => setToast(null), 5000);
  };
  triggerToastGlobal = triggerToast;

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerToast('System Online 🌐', 'Internet reconnected. Syncing cache...');
    };
    const handleOffline = () => {
      setIsOnline(false);
      triggerToast('Offline Warning 📴', 'You are currently disconnected.', 'warning');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUser(decoded);

        // Fetch full profile info from backend
        fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Failed to fetch profile details');
        })
        .then(fullUser => {
          setUser(fullUser);
        })
        .catch(err => {
          console.warn('Could not fetch full user details, relying on token payload:', err);
        });
      } catch (err) {
        localStorage.removeItem('fe_token');
        setToken(null);
      }
    }
  }, [token]);

  useEffect(() => {
    if (token && user) {
      const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      socketRef.current = io(apiBase, {
        auth: { token }
      });

      socketRef.current.emit('join_room', `user_${user.id}`);
      console.log(`Socket joined room: user_${user.id}`);

      // Socket event listeners
      socketRef.current.on('new_chat_message', (data) => {
        if (data.sender_id !== user.id) {
          triggerToast(`New Message from ${data.sender_name || 'Staff'} 💬`, data.message);
        }
      });

      socketRef.current.on('new_broadcast', (data) => {
        triggerToast(`Broadcast Alert 📢`, `${data.title}: ${data.message}`, 'warning');
      });

      socketRef.current.on('notification_received', (data) => {
        triggerToast(data.title || 'Notification 🔔', data.message || 'You have received an update.');
        fetchNotifications();
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    }
  }, [token, user]);

  const handleLogout = () => {
    localStorage.removeItem('fe_token');
    setToken(null);
    setUser(null);
    triggerToast('Logged Out', 'You have been disconnected safely.');
  };

  return (
    <div className={`${darkMode ? 'dark' : ''} min-h-screen font-sans bg-slate-950 text-slate-100 transition-colors duration-200 pb-12 relative overflow-hidden`}>
      {darkMode && (
        <>
          <div className="neon-glow-emerald top-12 left-1/4"></div>
          <div className="neon-glow-amber top-1/3 right-1/4"></div>
        </>
      )}
      {!isOnline && (
        <div className="offline-banner text-white text-center py-2 text-xs font-semibold tracking-wide flex items-center justify-center gap-2 animate-pulse sticky top-0 z-50 shadow-md bg-red-600">
          <AlertTriangle size={14} />
          {translate('offline')}
        </div>
      )}

      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Wheat className="text-emerald-500 animate-bounce-slow" size={26} />
          <span className="font-display font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
            {translate('title')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <button
              onClick={() => setShowNotificationsPanel(true)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition relative cursor-pointer"
              title="View Notifications"
            >
              <Bell size={14} className={unreadCount > 0 ? "text-amber-400 animate-swing" : "text-slate-400"} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-extrabold flex items-center justify-center text-white border border-slate-900 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setLang(lang === 'english' ? 'hindi' : 'english')}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1 border border-slate-700 transition"
          >
            <Globe size={14} className="text-amber-400" />
            {lang === 'english' ? 'Hi' : 'En'}
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            {darkMode ? <Sun size={14} className="text-yellow-400" /> : <Moon size={14} className="text-slate-500" />}
          </button>
          {user && (
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/40 border border-red-900/50 text-red-400 transition text-xs font-bold flex items-center gap-1"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6">
        {toast && (
          <div className={`toast fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex gap-3 items-start border animate-slide-up max-w-sm ${toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
              : 'bg-amber-950/90 border-amber-500/50 text-amber-100'
            }`}>
            <div className="mt-0.5">
              {toast.type === 'success' ? <CheckCircle2 className="text-emerald-400" size={18} /> : <AlertTriangle className="text-amber-400" size={18} />}
            </div>
            <div>
              <h4 className="font-bold text-sm">{toast.title}</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{toast.message}</p>
            </div>
          </div>
        )}

        {splash ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-namaste">
            <div className="relative mb-6">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 opacity-75 blur-lg"></div>
              <div className="relative bg-slate-900 p-6 rounded-full border border-slate-700">
                <Wheat size={64} className="text-yellow-500 animate-pulse" />
              </div>
            </div>
            <h1 className="font-display font-extrabold text-5xl tracking-widest text-white mb-2">
              {translate('namaste')}
            </h1>
            <p className="text-sm font-semibold tracking-widest text-emerald-400 animate-pulse">
              {translate('welcome').toUpperCase()}
            </p>
          </div>
        ) : (
          !user ? (
            <AuthWrapper
              view={authView}
              setView={setAuthView}
              translate={translate}
              setToken={setToken}
              setUser={setUser}
              triggerToast={triggerToast}
            />
          ) : (
            <RoleDashboard
              user={user}
              token={token}
              setToken={setToken}
              translate={translate}
              socket={socketRef.current}
              isOnline={isOnline}
              onUserUpdate={setUser}
            />
          )
        )}
      </main>

      {/* SLIDING NOTIFICATION DRAWER */}
      {showNotificationsPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity cursor-pointer"
            onClick={() => setShowNotificationsPanel(false)}
          />
          {/* Drawer */}
          <div className="notification-drawer fixed top-0 right-0 h-screen w-80 sm:w-96 bg-slate-950/95 border-l border-slate-850 backdrop-blur-md shadow-2xl p-6 z-50 overflow-y-auto animate-slide-left flex flex-col justify-between">
            <div className="space-y-6 flex-grow overflow-y-auto pr-1">
              <div className="flex justify-between items-center border-b border-slate-850 pb-4">
                <div className="flex items-center gap-2">
                  <Bell className="text-amber-400 animate-pulse" size={18} />
                  <h3 className="font-display font-extrabold text-base text-white font-sans">Alert Notifications</h3>
                </div>
                <button
                  onClick={() => setShowNotificationsPanel(false)}
                  className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">{unreadCount} unread alert(s)</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsAsRead}
                    className="text-emerald-400 hover:text-emerald-300 font-bold tracking-wide uppercase text-[10px] cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-16">No alerts received yet.</p>
                ) : (
                  notifications.map((n) => {
                    let icon = <Bell size={14} className="text-blue-400" />;
                    let bg = "bg-blue-950/50 border-blue-900/50";

                    if (n.title.toLowerCase().includes('payment') || n.title.toLowerCase().includes('money')) {
                      icon = <DollarSign size={14} className="text-emerald-400" />;
                      bg = "bg-emerald-950/50 border-emerald-900/50";
                    } else if (n.title.toLowerCase().includes('slip') || n.title.toLowerCase().includes('weighing') || n.title.toLowerCase().includes('correction') || n.title.toLowerCase().includes('proposed')) {
                      icon = <Scale size={14} className="text-amber-400" />;
                      bg = "bg-amber-950/50 border-amber-900/50";
                    } else if (n.title.toLowerCase().includes('pickup') || n.title.toLowerCase().includes('tractor') || n.title.toLowerCase().includes('logistics')) {
                      icon = <Truck size={14} className="text-cyan-400" />;
                      bg = "bg-cyan-950/50 border-cyan-900/50";
                    } else if (n.title.toLowerCase().includes('task') || n.title.toLowerCase().includes('duty')) {
                      icon = <Calendar size={14} className="text-purple-400" />;
                      bg = "bg-purple-950/50 border-purple-900/50";
                    }

                    return (
                      <div
                        key={n.id}
                        onClick={() => { if (!n.is_read) markSingleAsRead(n.id); }}
                        className={`notification-item ${n.is_read ? 'notification-item-read bg-slate-900/30 border-slate-850 opacity-60 hover:opacity-90' : `notification-item-unread ${bg} shadow-md`} p-3.5 rounded-xl border flex gap-3 text-xs leading-relaxed transition cursor-pointer select-none relative`}
                      >
                        <div className="mt-0.5 p-2 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center self-start">
                          {icon}
                        </div>
                        <div className="flex-grow space-y-0.5">
                          <h4 className="font-bold text-white flex justify-between items-center gap-2">
                            {n.title}
                            {!n.is_read && (
                              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0"></span>
                            )}
                          </h4>
                          <p className="text-slate-300 text-[11px] leading-relaxed">{n.message}</p>
                          <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider pt-1">
                            {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="border-t border-slate-850 pt-4 text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">FarmEase AgriTech System Log</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------
// AUTHENTICATION COMPONENT WRAPPER
// ----------------------------------------------------
function AuthWrapper({ view, setView, translate, setToken, setUser, triggerToast }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');

  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotLastPassword, setForgotLastPassword] = useState('');
  const [forgotLastPin, setForgotLastPin] = useState('');
  const [forgotName, setForgotName] = useState('');
  const [forgotVillage, setForgotVillage] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotNewPin, setForgotNewPin] = useState('');

  // Traditional Register (Optional fields - kept if admin edits manual records elsewhere, but disabled for public self-registration)
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regVillage, setRegVillage] = useState('');
  const [regUpi, setRegUpi] = useState('');
  const [loading, setLoading] = useState(false);

  // Profile completion states (for new Google users)
  const [completeEmail, setCompleteEmail] = useState('');
  const [completeName, setCompleteName] = useState('');
  const [completeIdToken, setCompleteIdToken] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('farmer');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [upiId, setUpiId] = useState('');
  const [pinCode, setPinCode] = useState('');

  // Simulation modal states
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simName, setSimName] = useState('Ramesh Patel');
  const [simEmail, setSimEmail] = useState('farmer@farmease.in');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = pin ? { loginId, pin } : { loginId, password };
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('fe_token', data.token);
        setToken(data.token);
        setUser(data.user);
        triggerToast('Welcome Back! 👋', `Logged in as ${data.user.name}`);
        confetti({ particleCount: 80, spread: 60 });
      } else {
        triggerToast('Login Failed ❌', data.message, 'warning');
      }
    } catch (err) {
      triggerToast('Server Connection Error', 'Ensure the backend server is running.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (regPhone.length !== 10) {
      triggerToast('Validation Error ❌', 'Phone number must be exactly 10 digits.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          phone: regPhone,
          email: regEmail,
          password: regPass,
          pin: regPin || '111111',
          role: 'farmer',
          address: regAddress,
          village: regVillage,
          upi_id: regUpi
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast('Registered successfully! 🎉', 'You can now log in.');
        setView('login');
        setLoginId(regPhone);
      } else {
        triggerToast('Registration failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToast('Registration Error', 'Check database service connection.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isFirebaseConfigured) {
      setLoading(true);
      try {
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();
        await sendGoogleAuthToBackend(idToken);
      } catch (err) {
        console.error("Google Sign-In failed:", err);
        triggerToast('Google Sign-In Failed ❌', err.message || 'Verification failed.', 'warning');
      } finally {
        setLoading(false);
      }
    } else {
      // Firebase not configured, open Developer Simulation Modal
      setSimName('Ramesh Patel');
      setSimEmail('farmer@farmease.in');
      setShowSimulateModal(true);
    }
  };

  const handleSimulatedSubmit = async (e) => {
    e.preventDefault();
    if (!simEmail || !simName) {
      triggerToast('Validation Error ❌', 'Name and Email are required.', 'warning');
      return;
    }
    setShowSimulateModal(false);
    setLoading(true);
    try {
      const mockToken = simulateGoogleSignIn(simEmail, simName);
      await sendGoogleAuthToBackend(mockToken);
    } catch (err) {
      triggerToast('Simulation Login Failed ❌', err.message, 'warning');
    } finally {
      setLoading(false);
    }
  };

  const sendGoogleAuthToBackend = async (idToken) => {
    try {
      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'PENDING_REGISTRATION') {
          // New User! Show profile completion form
          setCompleteEmail(data.email);
          setCompleteName(data.name);
          setCompleteIdToken(idToken);
          setView('complete_profile');
          triggerToast('Google Authenticated! 🔑', 'Please fill in additional profile details.');
        } else {
          // Existing User! Log them in immediately
          localStorage.setItem('fe_token', data.token);
          setToken(data.token);
          setUser(data.user);
          triggerToast('Welcome Back! 👋', `Logged in as ${data.user.name}`);
          confetti({ particleCount: 80, spread: 60 });
        }
      } else {
        triggerToast('Google Login Failed ❌', data.message, 'warning');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Connection Error', 'Failed to connect to backend server.', 'warning');
    }
  };

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    if (phone.length !== 10) {
      triggerToast('Validation Error ❌', 'Phone number must be exactly 10 digits.', 'warning');
      return;
    }
    if (!village) {
      triggerToast('Validation Error ❌', 'Village name is required.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/google-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: completeIdToken,
          phone,
          role,
          village,
          address,
          upi_id: upiId,
          pin: pinCode || '111111'
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('fe_token', data.token);
        setToken(data.token);
        setUser(data.user);
        triggerToast('Registration Complete! 🎉', `Welcome to FarmEase, ${data.user.name}!`);
        confetti({ particleCount: 100, spread: 80 });
      } else {
        triggerToast('Registration Failed ❌', data.message, 'warning');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Registration Error', 'Server error completing registration.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotPhone || !forgotLastPassword || !forgotLastPin || !forgotName || !forgotVillage || !forgotNewPassword || !forgotNewPin) {
      triggerToast('Validation Error ⚠️', 'All fields are required.', 'warning');
      return;
    }
    if (forgotPhone.length !== 10) {
      triggerToast('Validation Error ⚠️', 'Phone number must be exactly 10 digits.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: forgotPhone,
          last_password: forgotLastPassword,
          last_pin: forgotLastPin,
          name: forgotName,
          village: forgotVillage,
          new_password: forgotNewPassword,
          new_pin: forgotNewPin
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast('Request Submitted! 🔑', data.message || 'Recovery request successfully submitted for Admin approval!');
        confetti({ particleCount: 30 });
        setView('login');
        setForgotPhone('');
        setForgotLastPassword('');
        setForgotLastPin('');
        setForgotName('');
        setForgotVillage('');
        setForgotNewPassword('');
        setForgotNewPin('');
      } else {
        triggerToast('Request Failed ❌', data.message, 'warning');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error', 'Failed to submit recovery request.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 glass-panel p-8 rounded-2xl border border-slate-800 animate-slide-up relative">
      {view === 'login' && (
        <form onSubmit={handleLogin}>
          <h2 className="font-display font-extrabold text-2xl mb-2 text-white flex items-center gap-2">
            <User className="text-emerald-500" size={24} />
            {translate('login')}
          </h2>
          <p className="text-slate-400 text-xs mb-6">Enter credentials to enter your role-specific dashboard.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">{translate('phone')} / Email</label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="e.g. admin@farmease.in or 9876543210"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm transition outline-none text-white font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">{translate('password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3 text-sm transition outline-none text-white font-medium"
                disabled={!!pin}
              />
            </div>
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-[10px] uppercase font-bold tracking-widest">OR USE PIN</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">{translate('pin')}</label>
              <input
                type="password"
                value={pin}
                maxLength={6}
                onChange={(e) => setPin(e.target.value)}
                placeholder="e.g. 222222"
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-3 text-sm transition outline-none text-white font-medium"
                disabled={password.length > 0 && password !== 'admin123'}
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl mt-6 transition transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer btn-glow-green"
            disabled={loading}
          >
            {loading ? translate('loading') : translate('login')}
            <ArrowRight size={16} />
          </button>

          <div className="mt-6 flex flex-col gap-2 items-center text-xs">
            <button
              type="button"
              onClick={() => setView('signup')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              {translate('signup')}
            </button>
            <button
              type="button"
              onClick={() => setView('forgot')}
              className="text-amber-400 hover:text-amber-300 font-semibold mt-1"
            >
              {translate('forgot')}
            </button>
          </div>
        </form>
      )}

      {view === 'signup' && (
        <form onSubmit={handleRegister}>
          <h2 className="font-display font-extrabold text-2xl mb-2 text-white flex items-center gap-2">
            <Wheat className="text-emerald-500" size={24} />
            {translate('signup')}
          </h2>
          <p className="text-slate-400 text-xs mb-6">Create a new farmer profile to request pickups instantly.</p>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">{translate('name')} *</label>
              <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Ramesh Patel" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">{translate('phone')} *</label>
              <input type="text" maxLength={10} value={regPhone} onChange={e => setRegPhone(e.target.value.replace(/\D/g, ''))} placeholder="9876543210" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">{translate('password')} *</label>
              <input type="password" value={regPass} onChange={e => setRegPass(e.target.value)} placeholder="Min 6 characters" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">{translate('village')} *</label>
              <input type="text" value={regVillage} onChange={e => setRegVillage(e.target.value)} placeholder="Gokulpur" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">{translate('address')}</label>
              <textarea value={regAddress} onChange={e => setRegAddress(e.target.value)} placeholder="Farm House #4" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" rows={2} />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">{translate('upi')}</label>
              <input type="text" value={regUpi} onChange={e => setRegUpi(e.target.value)} placeholder="ramesh@okaxis" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
          </div>
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl mt-6 transition transform active:scale-95 cursor-pointer btn-glow-green" disabled={loading}>
            {translate('submit')}
          </button>
          <button type="button" onClick={() => setView('login')} className="w-full text-center text-xs text-slate-400 hover:text-slate-300 font-semibold mt-4 transition">
            {translate('back')}
          </button>
        </form>
      )}

      {view === 'complete_profile' && (
        <form onSubmit={handleCompleteRegistration}>
          <h2 className="font-display font-extrabold text-2xl mb-2 text-white flex items-center gap-2">
            <User className="text-emerald-500" size={24} />
            Complete Profile
          </h2>
          <p className="text-slate-400 text-xs mb-6">
            Authenticated as <span className="text-emerald-400 font-bold">{completeEmail}</span>. Please complete your registration details to continue.
          </p>

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                value={completeName}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 text-slate-400 font-bold cursor-not-allowed"
                disabled
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Select Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-emerald-500"
              >
                <option value="farmer">🌾 Farmer</option>
                <option value="worker">🚜 Field Worker</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Phone Number (10 digits) *</label>
              <input
                type="text"
                maxLength={10}
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2 text-white font-mono outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Village Name *</label>
              <input
                type="text"
                value={village}
                onChange={e => setVillage(e.target.value)}
                placeholder="e.g. Gokulpur"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2 text-white outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Address / Location Details (Optional)</label>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Farm landmarks or village plot number"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2 text-white outline-none"
                rows={2}
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">UPI ID for Direct Payouts (Optional)</label>
              <input
                type="text"
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                placeholder="e.g. name@upi"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2 text-white outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Worker Access PIN (Optional)</label>
              <input
                type="password"
                maxLength={6}
                value={pinCode}
                onChange={e => setPinCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 4-6 digit numeric PIN"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2 text-white font-mono outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl mt-6 transition transform active:scale-95 cursor-pointer btn-glow-green"
            disabled={loading}
          >
            {loading ? 'Completing Registration...' : 'Complete Profile & Log In'}
          </button>

          <button
            type="button"
            onClick={() => {
              setView('login');
              triggerToast('Cancelled', 'Registration process reset.');
            }}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-300 font-semibold mt-4 transition"
          >
            Cancel and Return
          </button>
        </form>
      )}

      {view === 'forgot' && (
        <form onSubmit={handleForgotPassword}>
          <h2 className="font-display font-extrabold text-2xl mb-2 text-white flex items-center gap-2">
            <Shield className="text-amber-500" size={24} />
            Forgot Password / PIN
          </h2>
          <p className="text-slate-400 text-xs mb-6">Fill in details. A password change request will be sent to the administrator for approval.</p>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
              <input type="text" value={forgotName} onChange={e => setForgotName(e.target.value)} placeholder="Enter your full name" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Phone Number (10 digits) *</label>
              <input type="text" maxLength={10} value={forgotPhone} onChange={e => setForgotPhone(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 9876543210" className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2 text-white font-mono outline-none" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Village Name *</label>
              <input type="text" value={forgotVillage} onChange={e => setForgotVillage(e.target.value)} placeholder="e.g. Gokulpur" className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2 text-white outline-none" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Last Password *</label>
              <input type="password" value={forgotLastPassword} onChange={e => setForgotLastPassword(e.target.value)} placeholder="Enter last remembered password" className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2 text-white outline-none" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Last PIN *</label>
              <input type="password" maxLength={6} value={forgotLastPin} onChange={e => setForgotLastPin(e.target.value.replace(/\D/g, ''))} placeholder="Enter last 4-6 digit PIN" className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2 text-white font-mono outline-none" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">New Desired Password *</label>
              <input type="password" value={forgotNewPassword} onChange={e => setForgotNewPassword(e.target.value)} placeholder="Enter new desired password" className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2 text-white outline-none" required />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">New Desired PIN *</label>
              <input type="password" maxLength={6} value={forgotNewPin} onChange={e => setForgotNewPin(e.target.value.replace(/\D/g, ''))} placeholder="Enter new desired 4-6 digit PIN" className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2 text-white font-mono outline-none" required />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-3 px-4 rounded-xl mt-6 transition transform active:scale-95 cursor-pointer btn-glow-amber text-xs uppercase tracking-wide"
            disabled={loading}
          >
            {loading ? 'Submitting Request...' : 'Submit Reset Request'}
          </button>

          <button
            type="button"
            onClick={() => {
              setView('login');
              triggerToast('Cancelled', 'Password recovery reset.');
            }}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-300 font-semibold mt-4 transition cursor-pointer"
          >
            Cancel and Return to Login
          </button>
        </form>
      )}

      {/* Developer Simulation Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xs z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-scale-up relative">
            <button
              type="button"
              onClick={() => setShowSimulateModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X size={14} />
            </button>
            <h3 className="font-display font-extrabold text-lg text-white mb-2 flex items-center gap-2">
              <Shield className="text-amber-400 animate-pulse" size={20} />
              Google Sign-In Simulator
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              Since no Firebase API credentials are yet configured in your `.env`, we have loaded Simulation Mode. Customize or select a preset to simulate a secure Google callback token.
            </p>

            <form onSubmit={handleSimulatedSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Simulated Name *</label>
                <input
                  type="text"
                  value={simName}
                  onChange={e => setSimName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Simulated Email *</label>
                <input
                  type="email"
                  value={simEmail}
                  onChange={e => setSimEmail(e.target.value)}
                  placeholder="e.g. farmer@farmease.in"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 rounded-xl cursor-pointer transition select-none"
                >
                  Simulate Google Callback
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setSimName('Demo Google Farmer'); setSimEmail('demo_farmer@gmail.com'); }}
                    className="flex-grow bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] text-slate-300 font-bold py-1.5 rounded-lg transition"
                  >
                    Preset: New Farmer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSimName('Ramesh Patel'); setSimEmail('farmer@farmease.in'); }}
                    className="flex-grow bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] text-slate-300 font-bold py-1.5 rounded-lg transition"
                  >
                    Preset: Seeded Ramesh
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// ROLE ROUTER DASHBOARD BOOTSTRAPPER
// ----------------------------------------------------
function RoleDashboard({ user, token, setToken, translate, socket, isOnline, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [totalAdminUnreadCount, setTotalAdminUnreadCount] = useState(0);
  const prevUnreadCountRef = useRef(0);
  const isInitialChatLoadRef = useRef(true);

  useEffect(() => {
    if (token && user && user.role !== 'admin' && user.role !== 'supervisor') {
      const fetchHelplineUnread = async () => {
        try {
          const res = await fetch('/api/chat/history/1?markRead=false', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) {
            const history = await res.json();
            const unread = history.filter(msg => msg.sender_id !== user.id && !msg.is_read).length;
            setUnreadChatCount(unread);
            if (isInitialChatLoadRef.current) {
              isInitialChatLoadRef.current = false;
            } else if (unread > prevUnreadCountRef.current) {
              playBeepSound();
            }
            prevUnreadCountRef.current = unread;
          }
        } catch (e) { }
      };

      fetchHelplineUnread();
      const interval = setInterval(fetchHelplineUnread, 4000);
      return () => clearInterval(interval);
    }
  }, [token, user]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-6 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-900">
            <Shield size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">{user.name}</h3>
            <p className="text-[10px] tracking-wider uppercase font-bold text-slate-400 mt-0.5">{translate(user.role)} Dashboard</p>
          </div>
        </div>
        {user.village && (
          <div className="text-left sm:text-right text-xs text-slate-400">
            <span className="font-semibold text-slate-300">{translate('village')}:</span> {user.village}
          </div>
        )}
      </div>

      <WeatherAdvisory village={user.village} />

      {(user.role === 'admin' || user.role === 'supervisor') && <AdminView token={token} translate={translate} activeTab={activeTab} setActiveTab={setActiveTab} user={user} onUserUpdate={onUserUpdate} setToken={setToken} totalAdminUnreadCount={totalAdminUnreadCount} setTotalAdminUnreadCount={setTotalAdminUnreadCount} />}
      {user.role === 'farmer' && <FarmerView token={token} translate={translate} activeTab={activeTab} setActiveTab={setActiveTab} user={user} onUserUpdate={onUserUpdate} setToken={setToken} unreadChatCount={unreadChatCount} resetUnreadChatCount={() => { setUnreadChatCount(0); prevUnreadCountRef.current = 0; }} />}
      {user.role === 'employee' && <EmployeeView token={token} translate={translate} activeTab={activeTab} setActiveTab={setActiveTab} user={user} onUserUpdate={onUserUpdate} setToken={setToken} unreadChatCount={unreadChatCount} resetUnreadChatCount={() => { setUnreadChatCount(0); prevUnreadCountRef.current = 0; }} />}
      {user.role === 'worker' && <WorkerView token={token} translate={translate} activeTab={activeTab} setActiveTab={setActiveTab} user={user} onUserUpdate={onUserUpdate} setToken={setToken} unreadChatCount={unreadChatCount} resetUnreadChatCount={() => { setUnreadChatCount(0); prevUnreadCountRef.current = 0; }} />}
    </div>
  );
}

// ----------------------------------------------------
// FARMER VIEW COMPONENT
// ----------------------------------------------------
function FarmerView({ token, translate, activeTab, setActiveTab, user, onUserUpdate, setToken, unreadChatCount, resetUnreadChatCount }) {
  const [prices, setPrices] = useState([]);
  const [requests, setRequests] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState({ total_amount: 0, paid_amount: 0, due_amount: 0 });
  const [ledger, setLedger] = useState([]);
  const [paymentReceipts, setPaymentReceipts] = useState([]);

  // Booking inputs
  const [cropName, setCropName] = useState('Wheat');
  const [qty, setQty] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('Morning (08:00 AM - 12:00 PM)');

  useEffect(() => {
    fetchPrices();
    fetchRequests();
    fetchReceipts();
    fetchPaymentSummary();
    fetchLedger();
    fetchPaymentReceipts();

    const pollInterval = setInterval(() => {
      fetchPrices();
      fetchRequests();
      fetchReceipts();
      fetchPaymentSummary();
      fetchLedger();
      fetchPaymentReceipts();
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [token]);

  const fetchPrices = async () => {
    const res = await fetch('/api/crops/prices');
    if (res.ok) setPrices(await res.json());
  };

  const fetchRequests = async () => {
    const res = await fetch('/api/pickup/my', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setRequests(await res.json());
  };

  const fetchReceipts = async () => {
    const res = await fetch('/api/farmer/receipts', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setReceipts(await res.json());
  };

  const fetchPaymentSummary = async () => {
    const res = await fetch('/api/farmer/payments', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setPaymentSummary(await res.json());
  };

  const fetchLedger = async () => {
    const res = await fetch('/api/farmer/transactions', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setLedger(await res.json());
  };

  const fetchPaymentReceipts = async () => {
    const res = await fetch('/api/farmer/payment-receipts', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setPaymentReceipts(await res.json());
  };

  const handleRespondEdit = async (procId, responseType) => {
    try {
      const res = await fetch(`/api/procurements/${procId}/respond-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ response: responseType })
      });
      if (res.ok) {
        triggerToastGlobal(
          responseType === 'approve' ? 'Edits Approved! ✅' : 'Edits Rejected ❌',
          responseType === 'approve' ? 'Weighing slip and payout changes successfully applied.' : 'Proposed edits have been declined.'
        );
        confetti({ particleCount: 30 });
        fetchReceipts();
        fetchPaymentSummary();
        fetchLedger();
      } else {
        const data = await res.json();
        triggerToastGlobal('Action Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Action failed.', 'warning');
    }
  };

  const handleBookPickup = async (e) => {
    e.preventDefault();
    const payload = {
      crop_name: cropName,
      estimated_quantity: parseFloat(qty),
      address,
      pickup_date: date,
      time_slot: slot
    };

    try {
      const res = await fetch('/api/pickup/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        triggerToastGlobal('Pickup Booked! 🚜', 'We have received your pickup request. Standard routing is under review.');
        confetti({ particleCount: 50 });
        setQty('');
        setAddress('');
        fetchRequests();
      }
    } catch (err) { }
  };

  const handleCancelPickup = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this crop pickup booking?')) return;
    try {
      const res = await fetch(`/api/pickup/${requestId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Booking Cancelled ❌', 'Your pickup request has been successfully cancelled.');
        fetchRequests();
      } else {
        triggerToastGlobal('Cancellation Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 lg:space-y-2 lg:col-span-1">
        <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'dashboard' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Wheat size={16} />
          {translate('dashboard')}
        </button>
        <button onClick={() => setActiveTab('prices')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'prices' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <DollarSign size={16} />
          {translate('prices')}
        </button>
        <button onClick={() => setActiveTab('book')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'book' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Calendar size={16} />
          {translate('bookPickup')}
        </button>
        <button onClick={() => setActiveTab('slips')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'slips' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <FileText size={16} />
          {translate('receipts')}
        </button>
        <button onClick={() => setActiveTab('ledger')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'ledger' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Wallet size={16} />
          {translate('payments')}
        </button>
        <button onClick={() => { setActiveTab('chat'); resetUnreadChatCount(); }} className={`w-full text-left p-3 rounded-xl flex items-center justify-between border font-bold text-sm transition ${activeTab === 'chat' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <div className="flex items-center gap-2">
            <MessageSquare size={16} />
            {translate('helpline')}
          </div>
          {unreadChatCount > 0 && activeTab !== 'chat' && (
            <span className="bg-red-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('profile')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'profile' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <User size={16} />
          My Profile
        </button>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-emerald-500">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">TOTAL EARNINGS</span>
                <h3 className="font-display font-extrabold text-2xl text-white mt-1">₹{paymentSummary.total_amount.toLocaleString('en-IN')}</h3>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-blue-500">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">AMOUNT RECEIVED</span>
                <h3 className="font-display font-extrabold text-2xl text-white mt-1">₹{paymentSummary.paid_amount.toLocaleString('en-IN')}</h3>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-amber-500">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">OUTSTANDING BALANCE</span>
                <h3 className="font-display font-extrabold text-2xl text-amber-400 mt-1">₹{paymentSummary.due_amount.toLocaleString('en-IN')}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <h4 className="font-display font-bold text-base text-white">Harvest Ready?</h4>
                  <p className="text-xs text-slate-400 mt-1">Quick-schedule a tractor collection to your farm village location with one click.</p>
                </div>
                <button onClick={() => setActiveTab('book')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl mt-4 flex items-center justify-center gap-1 transition cursor-pointer">
                  Schedule Collection Pickup
                  <ArrowRight size={14} />
                </button>
              </div>
              <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <h4 className="font-display font-bold text-base text-white">Helpline Desk</h4>
                  <p className="text-xs text-slate-400 mt-1">Ask our Mandi yard Helpline anything about price changes or logistics routes.</p>
                </div>
                <button onClick={() => { setActiveTab('chat'); resetUnreadChatCount(); }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl mt-4 flex items-center justify-center gap-1 transition cursor-pointer">
                  Open Support Chat
                  <MessageSquare size={14} />
                </button>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-display font-bold text-base text-white mb-4 flex items-center gap-2">
                <Clock className="text-emerald-500" size={18} />
                {translate('myPickups')}
              </h3>
              {requests.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No pickup requests scheduled.</p>
              ) : (
                <div className="space-y-4">
                  {requests.map((req) => (
                    <div key={req.id || Math.random()} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
                      <div>
                        <h4 className="text-sm font-bold text-white">{req.crop_name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Qty: {req.estimated_quantity} Qtl | Date: {req.pickup_date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleCancelPickup(req.id)}
                            className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/50 border border-red-900/50 text-red-400 font-bold text-[10px] rounded-lg transition cursor-pointer select-none"
                          >
                            Cancel
                          </button>
                        )}
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${req.status === 'pending' ? 'bg-amber-950 text-amber-400 border border-amber-900' :
                            req.status === 'assigned' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                              req.status === 'completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                                'bg-red-950 text-red-400'
                          }`}>
                          {req.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'prices' && (
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="font-display font-extrabold text-xl text-white">{translate('prices')}</h3>
              <p className="text-xs text-slate-400 mt-1">Live market buy rates updated directly from Mandi executives.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prices.map((p) => (
                <div key={p.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-950/50 text-emerald-400 rounded-lg">
                      <Wheat size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{p.crop_name}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display font-extrabold text-base text-emerald-400">₹{p.price_per_quintal}</span>
                    <p className="text-[9px] text-slate-500 mt-0.5">per quintal</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'book' && (
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="font-display font-extrabold text-xl text-white mb-2">{translate('bookPickup')}</h3>
            <p className="text-xs text-slate-400 mb-6">Request harvest vehicle assignment to your village.</p>
            <form onSubmit={handleBookPickup} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Select Crop</label>
                  <select value={cropName} onChange={(e) => setCropName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white">
                    {prices.map((p) => (
                      <option key={p.id} value={p.crop_name}>{p.crop_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Estimated Qty (Quintals)</label>
                  <input type="number" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 15.0" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Preferred Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white text-slate-400" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Preferred Time Slot</label>
                  <select value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white">
                    <option value="Morning (08:00 AM - 12:00 PM)">Morning (08:00 AM - 12:00 PM)</option>
                    <option value="Afternoon (12:00 PM - 04:00 PM)">Afternoon (12:00 PM - 04:00 PM)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Specific Field Location Landmarks</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Landmarks or village layout details" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white" rows={2} />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl mt-4 transition cursor-pointer">
                Confirm Request
              </button>
            </form>
          </div>
        )}

        {activeTab === 'slips' && (
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="font-display font-extrabold text-xl text-white">{translate('receipts')}</h3>
              <p className="text-xs text-slate-400 mt-1">Official digital crop weighing slips. Click download for PDF copies.</p>
            </div>

            {receipts.filter(r => r.edit_status === 'pending_farmer_approval').length > 0 && (
              <div className="bg-amber-950/20 border border-amber-900/50 rounded-2xl p-5 mb-6 space-y-4 animate-pulse-slow">
                <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Pending Weighing Slip Corrections Needing Your Approval
                </h4>
                <p className="text-xs text-slate-300">
                  The Admin has proposed corrections to the following weighing receipts. Please review the changes carefully and approve or reject them to update your payouts.
                </p>
                <div className="space-y-4 pt-2">
                  {receipts.filter(r => r.edit_status === 'pending_farmer_approval').map(slip => {
                    let edits = {};
                    try { edits = JSON.parse(slip.pending_edit_json); } catch (e) { }
                    return (
                      <div key={slip.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                        <div className="space-y-1 text-xs">
                          <span className="font-bold text-amber-400 text-sm">{slip.slip_id} ({slip.crop_name})</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-slate-400 mt-2">
                            <div>Weight: <span className="font-bold text-white">{edits.quintals} Qtl</span> <span className="text-[10px] text-slate-500">(Original: {slip.quintals} Qtl)</span></div>
                            <div className="bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30 text-emerald-400 font-bold self-start">
                              Proposed Rate: ₹{edits.rate_per_quintal}/Qtl <span className="text-[10px] text-slate-500 font-normal ml-1">(Original: ₹{slip.rate_per_quintal})</span>
                            </div>
                            <div>Deducted Amount: <span className="font-bold text-red-400">₹{Number(edits.deductions || 0).toLocaleString('en-IN')}</span> <span className="text-[10px] text-slate-500">(Original: ₹{Number(slip.deductions || 0).toLocaleString('en-IN')})</span></div>
                            <div>Total Payout: <span className="font-bold text-emerald-400">₹{edits.total_payout?.toLocaleString('en-IN')}</span> <span className="text-[10px] text-slate-500">(Original: ₹{slip.total_payout?.toLocaleString('en-IN')})</span></div>
                          </div>
                        </div>
                        <div className="flex gap-2 self-stretch md:self-auto justify-end">
                          <button
                            onClick={() => handleRespondEdit(slip.id, 'approve')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg cursor-pointer transition select-none flex-grow md:flex-grow-0"
                          >
                            Approve Edits
                          </button>
                          <button
                            onClick={() => handleRespondEdit(slip.id, 'reject')}
                            className="bg-red-950/40 hover:bg-red-900/40 border border-red-900/50 text-red-400 font-bold text-xs px-3.5 py-1.5 rounded-lg cursor-pointer transition select-none flex-grow md:flex-grow-0"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {receipts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No completions completed yet.</p>
            ) : (
              <div className="space-y-4">
                {receipts.map((slip) => (
                  <div key={slip.id} className="bg-slate-900/40 p-5 rounded-xl border border-slate-800 flex flex-col justify-between gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-400">{slip.slip_id}</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-xs text-slate-400">{new Date(slip.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 pb-2 border-b border-slate-800/30">
                          <h4 className="text-base font-extrabold text-white">{slip.crop_name}</h4>
                          <span className="text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold shadow-sm">
                            Rate: ₹{Number(slip.rate_per_quintal || 0).toLocaleString('en-IN')}/Qtl
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/50">
                          <p><span className="font-semibold text-slate-300">Farmer:</span> {slip.farmer_name || 'N/A'} ({slip.farmer_village || 'N/A'})</p>
                          <p><span className="font-semibold text-slate-300">Phone:</span> {slip.farmer_phone || 'N/A'}</p>
                          <p><span className="font-semibold text-slate-300">Operator:</span> {slip.weighed_by_name || 'Mandi Operator'}</p>
                          <p><span className="font-semibold text-slate-300">Bags:</span> {slip.bag_count} Bags</p>
                          <p><span className="font-semibold text-slate-300">Weight:</span> <span className="font-bold text-white">{slip.quintals.toFixed(2)} Qtl</span></p>
                          <p>
                            <span className="font-semibold text-slate-300">Deducted Amount:</span>{' '}
                            <span className={`font-bold ${slip.deductions > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                              ₹{Number(slip.deductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 justify-between md:justify-end">
                        <div className="text-right">
                          <span className="font-display font-extrabold text-base text-white">₹{slip.total_payout.toLocaleString('en-IN')}</span>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5 font-semibold">Expected pay</p>
                        </div>
                        <button
                          onClick={() => downloadReceiptPDF(slip)}
                          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded-xl border border-slate-700 transition cursor-pointer"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                    {slip.weight_image && (
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3">
                          <img src={slip.weight_image} className="w-10 h-10 object-cover rounded-lg border border-slate-700" alt="weight certification" />
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Weight Certificate scale photo attached</span>
                        </div>
                        <button
                          onClick={() => {
                            const win = window.open();
                            win.document.write(`<img src="${slip.weight_image}" style="max-width:100%; border-radius:12px;" />`);
                          }}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          View Full Image
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="font-display font-extrabold text-xl text-white">{translate('payments')}</h3>
              <p className="text-xs text-slate-400 mt-1">Full transaction ledger of all outstanding dues, bank advancements, and UPI credits.</p>
            </div>
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-3.5">Slip ID</th>
                    <th className="p-3.5">Crop</th>
                    <th className="p-3.5">Total Dues</th>
                    <th className="p-3.5">Amount Paid</th>
                    <th className="p-3.5">Outstanding Balance</th>
                    <th className="p-3.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {ledger.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/30">
                      <td className="p-3.5 font-bold">{row.slip_id || 'ADVANCE'}</td>
                      <td className="p-3.5">{row.crop_name || 'N/A'}</td>
                      <td className="p-3.5">₹{row.total_amount.toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-emerald-400">₹{row.paid_amount.toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-amber-400">₹{row.due_amount.toLocaleString('en-IN')}</td>
                      <td className="p-3.5">{new Date(row.payment_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Adjust Payments Section */}
            <div className="border-t border-slate-800/60 pt-6 space-y-4">
              <div>
                <h4 className="font-display font-extrabold text-base text-white flex items-center gap-2">
                  <Scale className="text-emerald-500" size={18} />
                  Adjust Payments & Ledger Status
                </h4>
                <p className="text-xs text-slate-400 mt-1">Review detail breakdowns of partial payments, pending clearances, and download individual transaction receipts.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {ledger.map((row) => {
                  const installments = paymentReceipts.filter(r => r.procurement_id === row.procurement_id && (r.receipt_type || 'installment') === 'installment');
                  const settlements = paymentReceipts.filter(r => r.procurement_id === row.procurement_id && r.receipt_type === 'settlement');
                  
                  let statusText = 'Pending Payment';
                  let statusClass = 'border-rose-900 text-rose-400 bg-rose-950/30';
                  if (row.due_amount === 0) {
                    statusText = 'Fully Paid & Settled';
                    statusClass = 'border-emerald-900 text-emerald-400 bg-emerald-950/30';
                  } else if (row.paid_amount > 0) {
                    statusText = 'Half Paid / Partial';
                    statusClass = 'border-amber-900 text-amber-400 bg-amber-950/30';
                  }

                  return (
                    <div key={row.id} className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/60 transition duration-200 space-y-4">
                      {/* Header row */}
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800/50 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">{row.slip_id || 'ADVANCE'}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-xs text-slate-500">{new Date(row.payment_date).toLocaleDateString()}</span>
                          </div>
                          <h5 className="text-sm font-extrabold text-white mt-1">{row.crop_name || 'N/A'}</h5>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${statusClass} self-start sm:self-auto`}>
                          {statusText}
                        </span>
                      </div>

                      {/* Info row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-950/30 p-3 rounded-xl border border-slate-900">
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Total Price</span>
                          <span className="font-bold text-white">₹{Number(row.total_amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Amount Paid</span>
                          <span className="font-bold text-emerald-400">₹{Number(row.paid_amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Remaining Due</span>
                          <span className="font-bold text-amber-400">₹{Number(row.due_amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase tracking-wider font-semibold">Market Rate / Qtl</span>
                          <span className="font-semibold text-slate-300">₹{Number(row.rate_per_quintal || 0).toLocaleString('en-IN')}/Qtl</span>
                          {Number(row.deductions || 0) > 0 && (
                            <span className="text-[9px] text-rose-400 block font-semibold">(Deducted: ₹{Number(row.deductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
                          )}
                        </div>
                      </div>

                      {/* Receipts breakdown list */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">Transaction Receipts</span>
                        
                        {/* If no receipts at all */}
                        {installments.length === 0 && settlements.length === 0 && (
                          <p className="text-[11px] text-slate-500 italic bg-slate-950/20 py-2.5 px-3 rounded-lg border border-slate-900">
                            No payment transactions have been logged for this record.
                          </p>
                        )}

                        {/* Installments (Partial/Half payments) */}
                        {installments.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold text-slate-500 tracking-wide uppercase">Partial Installment Payments:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {installments.map(inst => (
                                <div key={inst.id} className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 flex items-center justify-between text-[11px]">
                                  <div>
                                    <div className="font-bold text-emerald-500">{inst.receipt_no}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      Paid: <span className="font-bold text-slate-300">₹{Number(inst.amount_paid).toLocaleString('en-IN')}</span> ({inst.payment_mode.toUpperCase()})
                                    </div>
                                    <div className="text-[9px] text-slate-500 mt-0.5">{new Date(inst.created_at).toLocaleString()}</div>
                                  </div>
                                  <button
                                    onClick={() => downloadPaymentReceiptPDF(inst)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg border border-slate-700 transition cursor-pointer"
                                    title="Download Installment Receipt"
                                  >
                                    <Download size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Full Settlement Receipt */}
                        {settlements.map(settle => (
                          <div key={settle.id} className="bg-emerald-950/10 border border-emerald-900/30 rounded-xl p-3.5 flex items-center justify-between text-xs mt-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-emerald-400">{settle.receipt_no}</span>
                                <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/50 font-bold uppercase tracking-wider">Settled Full</span>
                              </div>
                              <p className="text-slate-400 text-[10px] mt-1">
                                Full payout cleared for total value of <span className="font-bold text-emerald-300">₹{Number(settle.total_amount).toLocaleString('en-IN')}</span>.
                              </p>
                              <p className="text-slate-500 text-[9px] mt-0.5">{new Date(settle.created_at).toLocaleString()}</p>
                            </div>
                            <button
                              onClick={() => downloadPaymentReceiptPDF(settle)}
                              className="p-2 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 rounded-lg border border-emerald-800/40 transition cursor-pointer"
                              title="Download Full Settlement Receipt"
                            >
                              <Download size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main Full Payment Receipts Section */}
            <div className="border-t border-slate-800/60 pt-6 space-y-3">
              <h4 className="font-display font-extrabold text-base text-white">Full Settlement Receipts</h4>
              {paymentReceipts.filter(r => (r.receipt_type || '') === 'settlement').length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-5 border border-slate-800 rounded-xl">No full settlement receipts have been issued yet. Settlement receipts are generated only upon full payment completion.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {paymentReceipts.filter(r => (r.receipt_type || '') === 'settlement').map((receipt) => (
                    <div key={receipt.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 text-xs flex items-center justify-between gap-4">
                      <div>
                        <span className="font-bold text-emerald-400">{receipt.receipt_no}</span>
                        <h5 className="text-sm font-bold text-white mt-1">{receipt.crop_name || 'Payment'} | {receipt.slip_id || 'N/A'}</h5>
                        <p className="text-slate-400 mt-0.5">Paid: INR {Number(receipt.amount_paid || 0).toLocaleString('en-IN')} | Due: INR {Number(receipt.due_after || 0).toLocaleString('en-IN')}</p>
                      </div>
                      <button
                        onClick={() => downloadPaymentReceiptPDF(receipt)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl border border-slate-700 transition cursor-pointer"
                        title="Download payment receipt"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat' && <HelplineChat token={token} peerId={1} translate={translate} user={user} />}
        {activeTab === 'profile' && <ProfileEditor token={token} setToken={setToken} user={user} onUserUpdate={onUserUpdate} />}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// WORKER VIEW COMPONENT
// ----------------------------------------------------
function WorkerView({ token, translate, activeTab, setActiveTab, user, onUserUpdate, setToken, unreadChatCount, resetUnreadChatCount }) {
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    fetchTasks();
    fetchAttendance();
  }, [token]);

  const fetchTasks = async () => {
    const res = await fetch('/api/tasks/my', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setTasks(await res.json());
  };

  const fetchAttendance = async () => {
    const res = await fetch('/api/attendance/history', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setAttendance(await res.json());
  };

  const handleAttendancePunch = async () => {
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal(data.isCheckOut ? 'Shift Checked Out' : 'Shift Started', data.message);
        confetti({ particleCount: 25, spread: 45 });
        fetchAttendance();
      } else {
        triggerToastGlobal('Attendance Notice', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Attendance Error', 'Could not update attendance right now.', 'warning');
    }
  };

  const handleTaskStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/tasks/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        triggerToastGlobal('Task Updated ✅', `Status shifted to ${status}.`);
        confetti({ particleCount: 30 });
        fetchTasks();
      }
    } catch (e) { }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 lg:space-y-2 lg:col-span-1">
        <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'dashboard' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Wheat size={16} />
          {translate('dashboard')}
        </button>
        <button onClick={() => setActiveTab('tasks')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'tasks' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Calendar size={16} />
          {translate('tasks')}
        </button>
        <button onClick={() => setActiveTab('attendance')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'attendance' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Clock size={16} />
          {translate('punchCard')}
        </button>
        <button onClick={() => { setActiveTab('chat'); resetUnreadChatCount(); }} className={`w-full text-left p-3 rounded-xl flex items-center justify-between border font-bold text-sm transition ${activeTab === 'chat' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <div className="flex items-center gap-2">
            <MessageSquare size={16} />
            {translate('helpline')}
          </div>
          {unreadChatCount > 0 && activeTab !== 'chat' && (
            <span className="bg-red-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('profile')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'profile' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <User size={16} />
          My Profile
        </button>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
              <h4 className="font-display font-extrabold text-lg text-white mb-2">Welcome to your Work Dashboard</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Check the "Assigned Duties" tab to view real-time crop collection logistics assigned to your tractor sheet today.
              </p>
            </div>

            {/* STUNNING DAILY PAY STATS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-emerald-500 bg-slate-900/40">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Total Days Worked</span>
                <h3 className="font-display font-extrabold text-2xl text-white mt-1">
                  {attendance.filter(r => r.status === 'present').length} Days
                </h3>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-blue-500 bg-slate-900/40">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Total Earnings</span>
                <h3 className="font-display font-extrabold text-2xl text-white mt-1">
                  ₹{attendance.reduce((sum, r) => sum + (r.daily_pay || 0), 0).toLocaleString('en-IN')}
                </h3>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-amber-500 bg-slate-900/40">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Avg. Daily Hours</span>
                <h3 className="font-display font-extrabold text-2xl text-amber-400 mt-1">
                  {attendance.filter(r => r.status === 'present').length > 0
                    ? (attendance.filter(r => r.status === 'present').reduce((sum, r) => sum + (r.working_hours || 0), 0) /
                      attendance.filter(r => r.status === 'present').length).toFixed(1)
                    : '0.0'} Hrs
                </h3>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl">
              <h4 className="font-display font-extrabold text-white text-base flex items-center gap-2">
                <MessageSquare className="text-emerald-500" size={18} />
                Helpline Support Desk
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Need details regarding pickup addresses or fuel bills? Connect directly to Rajesh Kumar (Admin) help desk.
              </p>
              <button onClick={() => { setActiveTab('chat'); resetUnreadChatCount(); }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl mt-4 items-center gap-1.5 transition outline-none cursor-pointer">
                Start Chat Session
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="font-display font-extrabold text-xl text-white">{translate('tasks')}</h3>
              <p className="text-xs text-slate-400 mt-1">Assigned pickups and grain samples collection duties.</p>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No operational duties assigned to your schedule.</p>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <div key={task.id} className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 text-xs">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {task.title}
                        {task.status === 'done' && <CheckCircle2 size={14} className="text-emerald-400" />}
                      </h4>
                      <p className="text-slate-400">{task.description}</p>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">DUE DATE: {task.due_date}</span>
                    </div>
                    <div className="flex gap-2">
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleTaskStatus(task.id, 'in_progress')}
                          className="bg-blue-950 text-blue-400 hover:bg-blue-900 border border-blue-900 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          Start Task
                        </button>
                      )}
                      {task.status !== 'done' && (
                        <button
                          onClick={() => handleTaskStatus(task.id, 'done')}
                          className="bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-900 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-display font-extrabold text-xl text-white">{translate('punchCard')}</h3>
                <p className="text-xs text-slate-400 mt-1">Start and close your field shift from the worker dashboard.</p>
              </div>
              <button
                onClick={handleAttendancePunch}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer transition select-none flex items-center justify-center gap-2"
              >
                <Clock size={15} />
                Punch In / Out
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Check In</th>
                    <th className="p-3.5">Check Out</th>
                    <th className="p-3.5">Hours</th>
                    <th className="p-3.5">Daily Earnings</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {attendance.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">No attendance records yet.</td>
                    </tr>
                  ) : (
                    attendance.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-900/20">
                        <td className="p-3.5 font-bold text-white">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="p-3.5">{row.check_in || '-'}</td>
                        <td className="p-3.5">{row.check_out || 'Active shift'}</td>
                        <td className="p-3.5 text-emerald-400 font-bold">{Number(row.working_hours || 0).toFixed(2)}</td>
                        <td className="p-3.5 font-bold text-white">₹{Number(row.daily_pay || 0).toLocaleString('en-IN')}</td>
                        <td className="p-3.5">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${row.check_out ? 'bg-emerald-950 text-emerald-400 border-emerald-900/50' : 'bg-amber-950 text-amber-400 border-amber-900/50'}`}>
                            {row.check_out ? row.status : 'on duty'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'chat' && <HelplineChat token={token} peerId={1} translate={translate} user={user} />}
        {activeTab === 'profile' && <ProfileEditor token={token} setToken={setToken} user={user} onUserUpdate={onUserUpdate} />}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// OFFICE OPERATOR (EMPLOYEE) VIEW COMPONENT
// ----------------------------------------------------
function EmployeeView({ token, translate, activeTab, setActiveTab, user, onUserUpdate, setToken, unreadChatCount, resetUnreadChatCount }) {
  const [farmers, setFarmers] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [procurements, setProcurements] = useState([]);
  const [prices, setPrices] = useState([]);
  const [attendance, setAttendance] = useState([]);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Register farmer fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [upi, setUpi] = useState('');

  // Redesigned direct-quintals weighing fields
  const [activePickupId, setActivePickupId] = useState('');
  const [activeFarmerId, setActiveFarmerId] = useState('');
  const [cropName, setCropName] = useState('Wheat');
  const [quintals, setQuintals] = useState('');
  const [rate, setRate] = useState('');
  const [bags, setBags] = useState('');
  const [deductions, setDeductions] = useState('');
  const [weightImage, setWeightImage] = useState('');

  const [transportCost, setTransportCost] = useState('');
  const [labourCost, setLabourCost] = useState('');

  const [isDirectFarmer, setIsDirectFarmer] = useState(false);
  const [directFarmerName, setDirectFarmerName] = useState('');
  const [directFarmerPhone, setDirectFarmerPhone] = useState('');
  const [directFarmerVillage, setDirectFarmerVillage] = useState('');
  const [customCropName, setCustomCropName] = useState('');

  const [calculatedPayout, setCalculatedPayout] = useState(0);

  useEffect(() => {
    fetchFarmers();
    fetchPickups();
    fetchWorkers();
    fetchProcurements();
    fetchPrices();
    fetchAttendance();

    const pollInterval = setInterval(() => {
      fetchPickups();
      fetchProcurements();
      fetchAttendance();
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [token]);

  const fetchFarmers = async () => {
    const res = await fetch(`/api/admin/farmers/list?search=${searchTerm}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setFarmers(await res.json());
  };

  const fetchPickups = async () => {
    const res = await fetch('/api/pickup/list', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setPickups(await res.json());
  };

  const fetchWorkers = async () => {
    const res = await fetch('/api/admin/workers/list', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setWorkers(await res.json());
  };

  const fetchProcurements = async () => {
    const res = await fetch('/api/procurements', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setProcurements(await res.json());
  };

  const fetchPrices = async () => {
    const res = await fetch('/api/crops/prices');
    if (res.ok) setPrices(await res.json());
  };

  const fetchAttendance = async () => {
    const res = await fetch('/api/attendance/history', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setAttendance(await res.json());
  };

  const handleAttendancePunch = async () => {
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal(data.isCheckOut ? 'Shift Checked Out' : 'Shift Started', data.message);
        confetti({ particleCount: 25, spread: 45 });
        fetchAttendance();
      } else {
        triggerToastGlobal('Attendance Notice', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Attendance Error', 'Could not update attendance right now.', 'warning');
    }
  };

  // Expected payout calculation: (quintals * rate) - deductions
  useEffect(() => {
    const q = parseFloat(quintals) || 0.0;
    const d = parseFloat(deductions) || 0.0;
    const r = parseFloat(rate) || 0.0;
    const payout = Math.max(0, (q * r) - d);
    setCalculatedPayout(payout);
  }, [quintals, deductions, rate]);

  const handleRegisterFarmer = async (e) => {
    e.preventDefault();
    if (phone.length !== 10) {
      triggerToastGlobal('Validation Error ❌', 'Phone number must be exactly 10 digits.', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password: 'farmer123', pin: '111111', role: 'farmer', address, village, upi_id: upi })
      });
      if (res.ok) {
        triggerToastGlobal('Farmer Registered! 🧑‍🌾', 'Farmer registered successfully. Seed password: farmer123');
        confetti({ particleCount: 40 });
        setName('');
        setPhone('');
        setVillage('');
        setAddress('');
        setUpi('');
        fetchFarmers();
      }
    } catch (err) { }
  };

  // FileReader uploader logic
  const handleImageFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setWeightImage(reader.result);
        triggerToastGlobal('Image Loaded 📸', 'Weighing scale photo uploaded successfully.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcure = async (e) => {
    e.preventDefault();
    if (!weightImage) {
      triggerToastGlobal('Attachment Required 📸', 'You must attach a weight scale photo before generating the slip.', 'warning');
      return;
    }

    const payload = {
      pickup_request_id: activePickupId ? parseInt(activePickupId) : null,
      farmer_id: isDirectFarmer ? null : (activeFarmerId ? parseInt(activeFarmerId) : null),
      farmer_name: isDirectFarmer ? directFarmerName : null,
      farmer_phone: isDirectFarmer ? directFarmerPhone : null,
      farmer_village: isDirectFarmer ? directFarmerVillage : null,
      crop_name: cropName === 'other' ? customCropName : cropName,
      quintals: parseFloat(quintals),
      rate_per_quintal: parseFloat(rate),
      bag_count: parseInt(bags),
      deductions: parseFloat(deductions) || 0.0,
      weight_image: weightImage,
      costs: [
        { cost_type: 'transport', amount: parseFloat(transportCost) || 0.0, note: 'Tractor logistical load' },
        { cost_type: 'labour', amount: parseFloat(labourCost) || 0.0, note: 'Loaders wages' }
      ]
    };

    try {
      const res = await fetch('/api/procurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Procurement Slip Generated 📄', `Slip ${data.slipId} recorded.`);
        confetti({ particleCount: 60 });
        setQuintals('');
        setRate('');
        setBags('');
        setDeductions('');
        setWeightImage('');
        setTransportCost('');
        setLabourCost('');
        setActivePickupId('');
        setIsDirectFarmer(false);
        setDirectFarmerName('');
        setDirectFarmerPhone('');
        setDirectFarmerVillage('');
        setCustomCropName('');
        fetchProcurements();
        fetchPickups();
        fetchFarmers();
      } else {
        triggerToastGlobal('Procurement Failed', data.message, 'warning');
      }
    } catch (err) { }
  };

  const handleAssignWorker = async (pickupId, workerId) => {
    try {
      const res = await fetch(`/api/pickup/${pickupId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ assigned_worker_id: parseInt(workerId), status: 'assigned' })
      });
      if (res.ok) {
        triggerToastGlobal('Worker Assigned! 🚜', 'Worker designated and task successfully assigned.');
        fetchPickups();
      }
    } catch (e) { }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 lg:space-y-2 lg:col-span-1">
        <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'dashboard' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Wheat size={16} />
          {translate('dashboard')}
        </button>
        <button onClick={() => setActiveTab('farmers')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'farmers' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Users size={16} />
          Farmers Directory
        </button>
        <button onClick={() => setActiveTab('procure')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'procure' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Scale size={16} />
          Weighing Slip Maker
        </button>
        <button onClick={() => { setActiveTab('chat'); resetUnreadChatCount(); }} className={`w-full text-left p-3 rounded-xl flex items-center justify-between border font-bold text-sm transition ${activeTab === 'chat' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <div className="flex items-center gap-2">
            <MessageSquare size={16} />
            {translate('helpline')}
          </div>
          {unreadChatCount > 0 && activeTab !== 'chat' && (
            <span className="bg-red-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('profile')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'profile' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <User size={16} />
          My Profile
        </button>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
              <h4 className="font-display font-extrabold text-lg text-white mb-2">Office Operator Dashboard</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Review farmer directory registers, allocate Worker driver tractor collection loops, and operate the digital procurement weighing scales form.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-display font-extrabold text-base text-white mb-4">Pending Logistics Allocation</h3>
              {pickups.filter(p => p.status === 'pending' || p.status === 'approved').length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No schedules pending.</p>
              ) : (
                <div className="space-y-4">
                  {pickups.filter(p => p.status === 'pending' || p.status === 'approved').map((p) => (
                    <div key={p.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="text-xs">
                        <h4 className="text-sm font-bold text-white">{p.farmer_name} ({p.farmer_village})</h4>
                        <p className="text-slate-400 mt-0.5">Crop: {p.crop_name} | Qty: {p.estimated_quantity} Qtl | Date: {p.pickup_date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          onChange={(e) => handleAssignWorker(p.id, e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-xs rounded-lg p-2 text-slate-300"
                          defaultValue=""
                        >
                          <option value="" disabled>Assign Worker Driver</option>
                          {workers.filter(w => w.role === 'worker').map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-display font-extrabold text-base text-white mb-4">Mandi Weighing Slips History</h3>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3">Slip ID</th>
                      <th className="p-3">Farmer</th>
                      <th className="p-3">Crop Details</th>
                      <th className="p-3">Weight</th>
                      <th className="p-3">Deducted Amount</th>
                      <th className="p-3">Expected Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {procurements.map((proc) => (
                      <tr key={proc.id} className="hover:bg-slate-900/20">
                        <td className="p-3 font-bold text-emerald-400">{proc.slip_id}</td>
                        <td className="p-3">
                          <span className="font-bold text-white block">{proc.farmer_name}</span>
                          <span className="text-[10px] text-slate-500 block">{proc.farmer_village}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold block">{proc.crop_name}</span>
                          <span className="text-[10px] text-emerald-400 font-bold block">Rate: ₹{Number(proc.rate_per_quintal || 0).toLocaleString('en-IN')}/Qtl</span>
                        </td>
                        <td className="p-3 font-semibold">{proc.quintals.toFixed(2)} Qtl</td>
                        <td className="p-3 font-semibold text-red-400">₹{proc.deductions.toFixed(2)}</td>
                        <td className="p-3 font-extrabold text-emerald-400">₹{proc.total_payout.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'farmers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                <Search size={16} className="text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyUp={fetchFarmers}
                  placeholder={translate('search')}
                  className="bg-transparent border-none outline-none text-xs text-white w-full"
                />
              </div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 text-xs">
                {farmers.map(f => (
                  <div key={f.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-bold text-white">{f.name}</h4>
                      <p className="text-slate-400 mt-0.5">Phone: {f.phone} | Village: {f.village}</p>
                    </div>
                    <button
                      onClick={() => {
                        setActiveFarmerId(f.id);
                        setActiveTab('procure');
                        triggerToastGlobal('Farmer Selected', `${f.name} loaded into weighing scales.`);
                      }}
                      className="bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-900 text-[10px] uppercase tracking-wider font-bold py-1.5 px-3 rounded-lg cursor-pointer transition"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl lg:col-span-1">
              <h3 className="font-display font-extrabold text-base text-white mb-4">Register Farmer</h3>
              <form onSubmit={handleRegisterFarmer} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ram Singh" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Phone</label>
                  <input type="text" maxLength={10} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 9876543210" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Village</label>
                  <input type="text" value={village} onChange={e => setVillage(e.target.value)} placeholder="e.g. Gokulpur" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Address</label>
                  <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Field address details" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" rows={2} />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg mt-2 cursor-pointer transition">
                  Create Farmer Profile
                </button>
              </form>
            </div>
          </div>
        )}

        {/* REDESIGNED WEIGHING SLIP MAKERS */}
        {activeTab === 'procure' && (
          <form onSubmit={handleProcure} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
              <h3 className="font-display font-extrabold text-base text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                <Scale className="text-emerald-400" size={20} />
                Direct Digital Weighing & Slip Generation
              </h3>
              <div className="sm:col-span-2 flex items-center justify-between bg-slate-900/50 border border-slate-800 p-3.5 rounded-xl mb-2">
                <div className="flex flex-col">
                  <span className="text-white font-bold text-xs">Direct Entry (Unregistered Farmer)</span>
                  <span className="text-[10px] text-slate-400">Generate a slip by entering new farmer details inline without pre-registering.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDirectFarmer}
                    onChange={(e) => {
                      setIsDirectFarmer(e.target.checked);
                      if (e.target.checked) {
                        setActiveFarmerId('');
                        setActivePickupId('');
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {isDirectFarmer ? (
                  <>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Farmer Name *</label>
                      <input
                        type="text"
                        value={directFarmerName}
                        onChange={e => setDirectFarmerName(e.target.value)}
                        placeholder="e.g. Ram Singh"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50 transition"
                        required={isDirectFarmer}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Phone Number *</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={directFarmerPhone}
                        onChange={e => setDirectFarmerPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 9876543210"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50 transition font-mono"
                        required={isDirectFarmer}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Village *</label>
                      <input
                        type="text"
                        value={directFarmerVillage}
                        onChange={e => setDirectFarmerVillage(e.target.value)}
                        placeholder="e.g. Gokulpur"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50 transition"
                        required={isDirectFarmer}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Target Farmer *</label>
                      <select
                        value={activeFarmerId}
                        onChange={(e) => setActiveFarmerId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white"
                        required={!isDirectFarmer}
                      >
                        <option value="" disabled>Select Farmer</option>
                        {farmers.map(f => (
                          <option key={f.id} value={f.id}>{f.name} ({f.village})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Linked Pickup Booking (Optional)</label>
                      <select
                        value={activePickupId}
                        onChange={(e) => {
                          setActivePickupId(e.target.value);
                          const selected = pickups.find(p => p.id === parseInt(e.target.value));
                          if (selected) {
                            setActiveFarmerId(selected.farmer_id);
                            setCropName(selected.crop_name);
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white"
                      >
                        <option value="">No linked booking</option>
                        {pickups.filter(p => p.status !== 'completed').map(p => (
                          <option key={p.id} value={p.id}>{p.crop_name} - {p.farmer_name} ({p.pickup_date})</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Crop Name</label>
                  <select value={cropName} onChange={e => setCropName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white">
                    {prices.map((p) => (
                      <option key={p.id} value={p.crop_name}>{p.crop_name}</option>
                    ))}
                    <option value="other">Other (Add New Crop...)</option>
                  </select>
                </div>

                {cropName === 'other' && (
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Custom Crop Name *</label>
                    <input
                      type="text"
                      value={customCropName}
                      onChange={e => setCustomCropName(e.target.value)}
                      placeholder="e.g. Mustard"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50 transition font-bold"
                      required={cropName === 'other'}
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Rate per Quintal (₹) *</label>
                  <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 2275" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white" required />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Total Weight (Quintals) *</label>
                  <input type="number" step="0.01" value={quintals} onChange={e => setQuintals(e.target.value)} placeholder="e.g. 81.2" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white" required />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Bag Count *</label>
                  <input type="number" value={bags} onChange={e => setBags(e.target.value)} placeholder="e.g. 160" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white" required />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Deductions Amount (₹)</label>
                  <input type="number" step="0.01" value={deductions} onChange={e => setDeductions(e.target.value)} placeholder="e.g. 500" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white" />
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition flex flex-col items-center justify-center text-center gap-3 relative cursor-pointer group pt-4 mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {weightImage ? (
                  <div className="space-y-2">
                    <img src={weightImage} className="max-h-36 mx-auto rounded-xl object-contain border border-slate-800 shadow-md" alt="Preview of weight scale" />
                    <span className="text-[10px] text-slate-500 font-bold block">TAP TO UPLOAD DIFFERENT SCREENSHOT</span>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-slate-900 text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-950/40 rounded-full border border-slate-800 transition">
                      <Camera size={26} />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-white">Upload Weight Scale Photo *</h5>
                      <p className="text-[10px] text-slate-500 mt-0.5">Capture scale readout screenshot. Required before slip generation.</p>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-slate-800 pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Optional Procurement Logistics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-300 mb-1">Transport Cost (₹)</label>
                    <input type="number" value={transportCost} onChange={e => setTransportCost(e.target.value)} placeholder="e.g. 1500" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white" />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Labour Wages (₹)</label>
                    <input type="number" value={labourCost} onChange={e => setLabourCost(e.target.value)} placeholder="e.g. 1000" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl lg:col-span-1 flex flex-col justify-between space-y-6">
              <div>
                <h3 className="font-display font-extrabold text-base text-slate-300 border-b border-slate-800 pb-2 mb-4 uppercase tracking-wider">Expected Payout</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Weighing:</span>
                    <span className="font-bold text-white">{(parseFloat(quintals) || 0).toFixed(2)} Qtl</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deducted Amount:</span>
                    <span className="font-bold text-red-400">-₹{(parseFloat(deductions || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-slate-300">
                    <span className="font-semibold">Net Quantity Weighed:</span>
                    <span className="font-bold text-white">{(parseFloat(quintals) || 0).toFixed(2)} Qtl</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-emerald-400">
                    <span className="font-bold">Total Expected Pay:</span>
                    <span className="font-display font-extrabold text-base">₹{calculatedPayout.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition cursor-pointer text-xs uppercase tracking-wide disabled:opacity-50"
                disabled={!weightImage}
              >
                {translate('processProcurement')}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'chat' && <HelplineChat token={token} peerId={1} translate={translate} user={user} />}
        {activeTab === 'profile' && <ProfileEditor token={token} setToken={setToken} user={user} onUserUpdate={onUserUpdate} />}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// ADMINISTRATOR VIEW COMPONENT (DUES CLEARING & FLEET CRUD)
// ----------------------------------------------------
function AdminView({ token, translate, activeTab, setActiveTab, user, onUserUpdate, setToken, totalAdminUnreadCount, setTotalAdminUnreadCount }) {
  const [stats, setStats] = useState({ netProfit: 0, totalRevenue: 0, totalExpenses: 0, payouts: 0, stockQuintals: 0, farmerOutstandingDues: 0 });
  const [prices, setPrices] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [staff, setStaff] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentReceipts, setPaymentReceipts] = useState([]);
  const [selectedReceiptForModal, setSelectedReceiptForModal] = useState(null);
  const prevAdminUnreadCountRef = useRef(0);
  const isInitialAdminChatLoadRef = useRef(true);
  const prevChatMessagesCountRef = useRef(0);

  // Weighing Slip Maker States
  const [activePickupId, setActivePickupId] = useState('');
  const [activeFarmerId, setActiveFarmerId] = useState('');
  const [procureCropName, setProcureCropName] = useState('Wheat');
  const [quintals, setQuintals] = useState('');
  const [rate, setRate] = useState('');
  const [bags, setBags] = useState('');
  const [deductions, setDeductions] = useState('');
  const [weightImage, setWeightImage] = useState('');
  const [transportCost, setTransportCost] = useState('');
  const [labourCost, setLabourCost] = useState('');
  const [calculatedPayout, setCalculatedPayout] = useState(0);

  const [isDirectFarmer, setIsDirectFarmer] = useState(false);
  const [directFarmerName, setDirectFarmerName] = useState('');
  const [directFarmerPhone, setDirectFarmerPhone] = useState('');
  const [directFarmerVillage, setDirectFarmerVillage] = useState('');
  const [customCropName, setCustomCropName] = useState('');

  const [recoveryRequests, setRecoveryRequests] = useState([]);

  const [showAddTaskForm, setShowAddTaskForm] = useState(false);

  // Expected payout calculation: (quintals * rate) - deductions
  useEffect(() => {
    const q = parseFloat(quintals) || 0.0;
    const d = parseFloat(deductions) || 0.0;
    const r = parseFloat(rate) || 0.0;
    const payout = Math.max(0, (q * r) - d);
    setCalculatedPayout(payout);
  }, [quintals, deductions, rate]);

  const handleImageFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setWeightImage(reader.result);
        triggerToastGlobal('Image Loaded 📸', 'Weighing scale photo uploaded successfully.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcure = async (e) => {
    e.preventDefault();
    if (!weightImage) {
      triggerToastGlobal('Attachment Required 📸', 'You must attach a weight scale photo before generating the slip.', 'warning');
      return;
    }

    const payload = {
      pickup_request_id: activePickupId ? parseInt(activePickupId) : null,
      farmer_id: isDirectFarmer ? null : (activeFarmerId ? parseInt(activeFarmerId) : null),
      farmer_name: isDirectFarmer ? directFarmerName : null,
      farmer_phone: isDirectFarmer ? directFarmerPhone : null,
      farmer_village: isDirectFarmer ? directFarmerVillage : null,
      crop_name: procureCropName === 'other' ? customCropName : procureCropName,
      quintals: parseFloat(quintals),
      rate_per_quintal: parseFloat(rate),
      bag_count: parseInt(bags),
      deductions: parseFloat(deductions) || 0.0,
      weight_image: weightImage,
      costs: [
        { cost_type: 'transport', amount: parseFloat(transportCost) || 0.0, note: 'Tractor logistical load' },
        { cost_type: 'labour', amount: parseFloat(labourCost) || 0.0, note: 'Loaders wages' }
      ]
    };

    try {
      const res = await fetch('/api/procurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Procurement Slip Generated 📄', `Slip ${data.slipId} recorded.`);
        confetti({ particleCount: 60 });
        setQuintals('');
        setRate('');
        setBags('');
        setDeductions('');
        setWeightImage('');
        setTransportCost('');
        setLabourCost('');
        setActivePickupId('');
        setIsDirectFarmer(false);
        setDirectFarmerName('');
        setDirectFarmerPhone('');
        setDirectFarmerVillage('');
        setCustomCropName('');
        fetchPickups();
        fetchFarmers();
        fetchDashboardStats();
        if (typeof fetchInventory === 'function') fetchInventory();
        if (typeof fetchPayments === 'function') fetchPayments();
        if (typeof fetchPaymentReceipts === 'function') fetchPaymentReceipts();
      } else {
        triggerToastGlobal('Procurement Failed', data.message, 'warning');
      }
    } catch (err) { }
  };

  // General Dues & Advances
  const [duesSubTab, setDuesSubTab] = useState('crop');
  const [duesAdvances, setDuesAdvances] = useState([]);
  const [newDueUserId, setNewDueUserId] = useState('');
  const [newDueType, setNewDueType] = useState('due');
  const [newDueAmount, setNewDueAmount] = useState('');
  const [newDueReason, setNewDueReason] = useState('');

  // Pricing Form
  const [cropName, setCropName] = useState('Wheat');
  const [newCropName, setNewCropName] = useState('');
  const [priceVal, setPriceVal] = useState('');

  // Task Form
  const [taskWorkerId, setTaskWorkerId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDue, setTaskDue] = useState('');

  // Sale Form
  const [saleCrop, setSaleCrop] = useState('Wheat');
  const [saleQty, setSaleQty] = useState('');
  const [saleBuyer, setSaleBuyer] = useState('');
  const [saleRate, setSaleRate] = useState('');
  const [saleTruck, setSaleTruck] = useState('');

  // Broadcast Form
  const [bTitle, setBTitle] = useState('');
  const [bMsg, setBMsg] = useState('');

  // Chat/Helpline states
  const [activePeerId, setActivePeerId] = useState('');
  const [chatUsers, setChatUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');

  // Fleet CRUD state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVehicleNo, setNewVehicleNo] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('Tractor Trolley');
  const [newVehicleDriver, setNewVehicleDriver] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editNumber, setEditNumber] = useState('');
  const [editType, setEditType] = useState('');
  const [editDriver, setEditDriver] = useState('');

  // Warehouse Stock CRUD states
  const [showAddCropStockForm, setShowAddCropStockForm] = useState(false);
  const [newStockCropName, setNewStockCropName] = useState('');
  const [newStockQty, setNewStockQty] = useState('');
  const [newStockLocation, setNewStockLocation] = useState('');

  const [editingStockId, setEditingStockId] = useState(null);
  const [editStockName, setEditStockName] = useState('');
  const [editStockQty, setEditStockQty] = useState('');
  const [editStockLocation, setEditStockLocation] = useState('');

  // Farmers Management States for Admin
  const [farmers, setFarmers] = useState([]);
  const [farmersSearchTerm, setFarmersSearchTerm] = useState('');

  const [newFarmerName, setNewFarmerName] = useState('');
  const [newFarmerPhone, setNewFarmerPhone] = useState('');
  const [newFarmerVillage, setNewFarmerVillage] = useState('');
  const [newFarmerAddress, setNewFarmerAddress] = useState('');
  const [newFarmerUpi, setNewFarmerUpi] = useState('');
  const [newFarmerPass, setNewFarmerPass] = useState('');

  const [editingFarmerId, setEditingFarmerId] = useState(null);
  const [editFarmerName, setEditFarmerName] = useState('');
  const [editFarmerPhone, setEditFarmerPhone] = useState('');
  const [editFarmerVillage, setEditFarmerVillage] = useState('');
  const [editFarmerAddress, setEditFarmerAddress] = useState('');
  const [editFarmerUpi, setEditFarmerUpi] = useState('');
  const [editFarmerPass, setEditFarmerPass] = useState('');

  // Staff CRUD state
  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('worker');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffPass, setNewStaffPass] = useState('');
  const [newStaffPayRate, setNewStaffPayRate] = useState('');
  const [newStaffHours, setNewStaffHours] = useState('');

  // Staff Edit state
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffRole, setEditStaffRole] = useState('');
  const [editStaffPin, setEditStaffPin] = useState('');
  const [editStaffPass, setEditStaffPass] = useState('');
  const [editStaffPayRate, setEditStaffPayRate] = useState('');
  const [editStaffHours, setEditStaffHours] = useState('');

  const [newStaffPayType, setNewStaffPayType] = useState('daily');
  const [editStaffPayType, setEditStaffPayType] = useState('daily');

  // Daily pay feeding & manual attendance state
  const [adminAttendance, setAdminAttendance] = useState([]);
  const [staffTabMode, setStaffTabMode] = useState('list'); // 'list' or 'attendance'
  const [manualWorkStaffId, setManualWorkStaffId] = useState('');
  const [manualWorkDate, setManualWorkDate] = useState('');
  const [manualWorkHours, setManualWorkHours] = useState('8');
  const [manualWorkPay, setManualWorkPay] = useState('');
  const [manualWorkStatus, setManualWorkStatus] = useState('present');
  const [showManualAttendanceForm, setShowManualAttendanceForm] = useState(false);

  // Operational Costs logging states
  const [operationalCosts, setOperationalCosts] = useState([]);
  const [showLogCostForm, setShowLogCostForm] = useState(false);
  const [newCostType, setNewCostType] = useState('Fuel');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [newCostNote, setNewCostNote] = useState('');

  const [showLogFuelForm, setShowLogFuelForm] = useState(false);
  const [fuelLogVehicleNumber, setFuelLogVehicleNumber] = useState('');
  const [fuelLogFuel, setFuelLogFuel] = useState('');

  const [loading, setLoading] = useState(false);

  // New payout details and partial payment state
  const [selectedPaymentForPayout, setSelectedPaymentForPayout] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMode, setPayoutMode] = useState('upi');

  // New admin slip edit proposal state
  const [procurements, setProcurements] = useState([]);
  const [selectedSlipForEdit, setSelectedSlipForEdit] = useState(null);
  const [editSlipWeight, setEditSlipWeight] = useState('');
  const [editSlipRate, setEditSlipRate] = useState('');
  const [editSlipBags, setEditSlipBags] = useState('');
  const [editSlipDeductions, setEditSlipDeductions] = useState('');

  useEffect(() => {
    fetchDashboardStats();
    fetchPrices();
    fetchInventory();
    fetchPickups();
    fetchStaff();
    fetchVehicles();
    fetchAiSuggestions();
    fetchChatUsers();
    fetchPayments();
    fetchPaymentReceipts();
    fetchProcurements();
    fetchDuesAdvances();
    fetchOperationalCosts();
    fetchFarmers();
    fetchAdminAttendance();
    fetchRecoveryRequests();

    const pollInterval = setInterval(() => {
      fetchDashboardStats();
      fetchPrices();
      fetchInventory();
      fetchPickups();
      fetchStaff();
      fetchVehicles();
      fetchAiSuggestions();
      fetchChatUsers();
      fetchPayments();
      fetchPaymentReceipts();
      fetchProcurements();
      fetchDuesAdvances();
      fetchOperationalCosts();
      fetchFarmers();
      fetchAdminAttendance();
      fetchRecoveryRequests();
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [token]);

  const fetchProcurements = async () => {
    try {
      const res = await fetch('/api/procurements', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setProcurements(await res.json());
    } catch (e) { }
  };

  const handleProposeEditSubmit = async (e) => {
    e.preventDefault();
    if (!editSlipWeight || !editSlipRate || !editSlipBags) {
      triggerToastGlobal('Validation Error', 'Weight, Rate, and Bags count are required.', 'warning');
      return;
    }

    try {
      const res = await fetch(`/api/procurements/${selectedSlipForEdit.id}/propose-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          quintals: parseFloat(editSlipWeight),
          rate_per_quintal: parseFloat(editSlipRate),
          bag_count: parseInt(editSlipBags),
          deductions: parseFloat(editSlipDeductions) || 0.0
        })
      });
      if (res.ok) {
        triggerToastGlobal('Edit Proposed! 📝', `Proposed corrections dispatched to farmer ${selectedSlipForEdit.farmer_name} for approval.`);
        confetti({ particleCount: 30 });
        setSelectedSlipForEdit(null);
        fetchProcurements();
        fetchPayments();
      } else {
        const data = await res.json();
        triggerToastGlobal('Proposal Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Failed to submit proposal.', 'warning');
    }
  };

  const handleForceRespondEdit = async (slipId, response) => {
    const actionText = response === 'approve' ? 'force-approve' : 'cancel';
    if (!confirm(`Are you sure you want to ${actionText} this proposed edit correction?`)) return;

    try {
      const res = await fetch(`/api/procurements/${slipId}/respond-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ response })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal(
          response === 'approve' ? 'Edits Force Applied! ✅' : 'Proposal Cancelled ❌',
          data.message
        );
        confetti({ particleCount: 30 });
        fetchProcurements();
        fetchPayments();
        fetchDashboardStats();
      } else {
        triggerToastGlobal('Action Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Failed to submit response.', 'warning');
    }
  };

  const handleShowLatestPaymentReceipt = async (procurementId) => {
    try {
      const res = await fetch(`/api/farmer/payment-receipts/procurement/${procurementId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        triggerToastGlobal('No Receipt Found', data.message || 'Could not locate payment receipts for this procurement slip.', 'warning');
        return;
      }
      const summary = await res.json();
      const fallbackLatest = paymentReceipts.find(r => r.procurement_id === procurementId);
      const chosenReceipt = summary.settlementReceipt || fallbackLatest;
      if (!chosenReceipt) {
        triggerToastGlobal('No Receipt Found', 'Could not locate payment receipts for this procurement slip.', 'warning');
        return;
      }
      setSelectedReceiptForModal({
        ...chosenReceipt,
        paymentSummary: summary,
        breakdown: summary?.breakdown || chosenReceipt.breakdown || null
      });
    } catch (e) {
      triggerToastGlobal('Error', 'Failed to load paid slip summary.', 'warning');
    }
  };

  const handleDownloadSettlementReceipt = async (procurementId) => {
    try {
      const res = await fetch(`/api/farmer/payment-receipts/procurement/${procurementId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const summary = await res.json();
        const chosenReceipt = summary.settlementReceipt;
        if (chosenReceipt) {
          downloadPaymentReceiptPDF(chosenReceipt);
        } else {
          triggerToastGlobal('No Receipt', 'Settlement receipt not found.', 'warning');
        }
      } else {
        triggerToastGlobal('No Receipt', 'Settlement receipt not found on server.', 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  useEffect(() => {
    if (activePeerId) {
      fetchChatHistory();
      const interval = setInterval(fetchChatHistory, 3000);
      return () => clearInterval(interval);
    }
  }, [activePeerId]);

  const fetchDashboardStats = async () => {
    const res = await fetch('/api/admin/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setStats(await res.json());
  };

  const fetchPrices = async () => {
    const res = await fetch('/api/crops/prices');
    if (res.ok) setPrices(await res.json());
  };

  const fetchInventory = async () => {
    const res = await fetch('/api/admin/inventory', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setInventory(await res.json());
  };

  const fetchPickups = async () => {
    const res = await fetch('/api/pickup/list', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setPickups(await res.json());
  };

  const fetchStaff = async () => {
    const res = await fetch('/api/admin/workers/list', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setStaff(await res.json());
  };

  const fetchAdminAttendance = async () => {
    const res = await fetch('/api/admin/attendance', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setAdminAttendance(await res.json());
  };

  const fetchVehicles = async () => {
    const res = await fetch('/api/admin/vehicles', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setVehicles(await res.json());
  };

  const fetchOperationalCosts = async () => {
    const res = await fetch('/api/admin/costs', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setOperationalCosts(await res.json());
  };

  const fetchFarmers = async () => {
    const res = await fetch(`/api/admin/farmers/list?search=${farmersSearchTerm}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setFarmers(await res.json());
  };

  const fetchAiSuggestions = async () => {
    const res = await fetch('/api/admin/price-trends', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setAiSuggestions(await res.json());
  };

  const fetchChatUsers = async () => {
    const res = await fetch('/api/chat/list', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setChatUsers(data);
      const totalUnread = data.reduce((sum, u) => sum + (u.unread_count || 0), 0);
      setTotalAdminUnreadCount(totalUnread);
      if (isInitialAdminChatLoadRef.current) {
        isInitialAdminChatLoadRef.current = false;
      } else if (totalUnread > prevAdminUnreadCountRef.current) {
        playBeepSound();
      }
      prevAdminUnreadCountRef.current = totalUnread;
    }
  };

  const fetchPayments = async () => {
    const res = await fetch('/api/farmer/payments/all', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setPayments(await res.json());
  };

  const fetchPaymentReceipts = async () => {
    const res = await fetch('/api/farmer/payment-receipts/all', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) setPaymentReceipts(await res.json());
  };

  const fetchDuesAdvances = async () => {
    try {
      const res = await fetch('/api/farmer/dues-advances/all', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setDuesAdvances(await res.json());
    } catch (e) { }
  };

  const fetchRecoveryRequests = async () => {
    try {
      const res = await fetch('/api/admin/forgot-password/list', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        setRecoveryRequests(await res.json());
      }
    } catch (e) { }
  };

  const handleResolveRecovery = async (id, action) => {
    try {
      const res = await fetch(`/api/admin/forgot-password/${id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal(action === 'approve' ? 'Request Approved! 🔑' : 'Request Rejected ❌', data.message);
        if (action === 'approve') {
          confetti({ particleCount: 30 });
        }
        fetchRecoveryRequests();
      } else {
        triggerToastGlobal('Action Failed', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  const handleDeleteRecovery = async (id) => {
    if (!confirm('Are you sure you want to remove this recovery request history record?')) return;
    try {
      const res = await fetch(`/api/admin/forgot-password/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Record Removed 🗑️', 'Recovery request history deleted.');
        fetchRecoveryRequests();
      } else {
        triggerToastGlobal('Action Failed', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  const handleClearDueAdvance = async (daId, user_name, amount, type) => {
    if (!confirm(`Are you sure you want to mark this ${type} of ₹${amount} for ${user_name} as fully cleared?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/farmer/dues-advances/${daId}/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        triggerToastGlobal('Cleared! ✅', 'The due/advance outstanding record has been fully cleared.');
        confetti({ particleCount: 30 });
        fetchDuesAdvances();
        fetchDashboardStats();
      } else {
        const data = await res.json();
        triggerToastGlobal('Action Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Failed to clear outstanding balance.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDueAdvance = async (e) => {
    e.preventDefault();
    if (!newDueUserId || !newDueAmount || !newDueReason) {
      triggerToastGlobal('Validation Error', 'Please fill all due/advance recording fields.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/farmer/dues-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          user_id: parseInt(newDueUserId),
          type: newDueType,
          amount: parseFloat(newDueAmount),
          reason: newDueReason
        })
      });
      if (res.ok) {
        triggerToastGlobal('Dues/Advance Logged 💰', 'Outstanding balance has been registered and user notified.');
        confetti({ particleCount: 30 });
        setNewDueUserId('');
        setNewDueAmount('');
        setNewDueReason('');
        setDuesSubTab('general');
        fetchDuesAdvances();
        fetchDashboardStats();
      } else {
        const data = await res.json();
        triggerToastGlobal('Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Failed to register outstanding due/advance.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const fetchChatHistory = async () => {
    if (!activePeerId) return;
    const res = await fetch(`/api/chat/history/${activePeerId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      setMessages(await res.json());
      fetchChatUsers();
    }
  };

  const handleDeleteMessageAdmin = async (msgId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      const res = await fetch(`/api/chat/message/${msgId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchChatHistory();
      } else {
        const data = await res.json();
        triggerToastGlobal('Action Failed', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  const handleClearConversationAdmin = async (peer_id) => {
    if (!confirm('Are you sure you want to clear the entire chat conversation with this user?')) return;
    try {
      const res = await fetch(`/api/chat/conversation/${peer_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        triggerToastGlobal('Conversation Cleared 🗑️', 'Chat log cleared.');
        fetchChatHistory();
        fetchChatUsers();
      } else {
        const data = await res.json();
        triggerToastGlobal('Action Failed', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  const handleUpdatePrice = async (e) => {
    e.preventDefault();
    const targetCrop = (newCropName.trim() || cropName).trim();
    if (!targetCrop) {
      triggerToastGlobal('Crop Required', 'Select an existing crop or enter a new crop name.', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/crops/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ crop_name: targetCrop, price_per_quintal: parseFloat(priceVal) })
      });
      if (res.ok) {
        triggerToastGlobal('Crop Price Updated 🌾', 'Live buy prices adjusted.');
        confetti({ particleCount: 30 });
        setCropName(targetCrop);
        setNewCropName('');
        setPriceVal('');
        fetchPrices();
        fetchAiSuggestions();
      }
    } catch (err) { }
  };

  const handleDeleteCrop = async (crop) => {
    if (!confirm(`Remove ${crop.crop_name} from the active crop board? Existing slips and inventory history will stay unchanged.`)) return;

    try {
      const res = await fetch(`/api/crops/prices/${crop.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Crop Removed', data.message);
        fetchPrices();
        fetchAiSuggestions();
      } else {
        triggerToastGlobal('Remove Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Could not remove crop right now.', 'warning');
    }
  };

  const handlePickupApprove = async (id, employeeId, workerId) => {
    try {
      const res = await fetch(`/api/pickup/${id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ assigned_employee_id: parseInt(employeeId), assigned_worker_id: parseInt(workerId), status: 'approved' })
      });
      if (res.ok) {
        triggerToastGlobal('Pickup Request Approved! 🚜', 'Staff assigned to scheduled routes.');
        confetti({ particleCount: 30 });
        fetchPickups();
      }
    } catch (e) { }
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ assigned_to: parseInt(taskWorkerId), title: taskTitle, description: taskDesc, due_date: taskDue })
      });
      if (res.ok) {
        triggerToastGlobal('Task Dispatched! 📋', 'Worker dashboard updated with duty details.');
        setTaskWorkerId('');
        setTaskTitle('');
        setTaskDesc('');
        setTaskDue('');
        setShowAddTaskForm(false);
      }
    } catch (e) { }
  };

  const handleLogSale = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          crop_name: saleCrop,
          quantity: parseFloat(saleQty),
          buyer_name: saleBuyer,
          sale_price_per_quintal: parseFloat(saleRate),
          truck_number: saleTruck
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Outward Sale Logged 🚚', `Stock cleared. Total revenue recorded: ₹${data.totalSaleAmount.toLocaleString('en-IN')}`);
        confetti({ particleCount: 80, spread: 60 });
        setSaleQty('');
        setSaleBuyer('');
        setSaleRate('');
        setSaleTruck('');
        fetchDashboardStats();
        fetchInventory();
      } else {
        triggerToastGlobal('Outward Sale Denied', data.message, 'warning');
      }
    } catch (e) { }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: bTitle, message: bMsg })
      });
      if (res.ok) {
        triggerToastGlobal('Broadcast Transmitted 📢', 'Global alert dispatched.');
        setBTitle('');
        setBMsg('');
      }
    } catch (e) { }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activePeerId) return;

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ receiver_id: parseInt(activePeerId), message: typedMessage })
      });
      if (res.ok) {
        setTypedMessage('');
        fetchChatHistory();
      }
    } catch (e) { }
  };

  const handleSaveDailyPay = async (attendanceId, payAmount) => {
    try {
      const res = await fetch('/api/admin/attendance/daily-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ attendance_id: attendanceId, daily_pay: parseFloat(payAmount) || 0.0 })
      });
      if (res.ok) {
        triggerToastGlobal('Daily Pay Logged! 💸', 'Daily wage fed to database register.');
        fetchAdminAttendance();
      } else {
        const data = await res.json();
        triggerToastGlobal('Failed to save pay', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Connection failure saving daily pay.', 'warning');
    }
  };

  const handleSaveManualAttendance = async (e) => {
    e.preventDefault();
    if (!manualWorkStaffId || !manualWorkDate) {
      triggerToastGlobal('Validation Error ❌', 'Please specify a staff member and select a date.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          user_id: parseInt(manualWorkStaffId),
          date: manualWorkDate,
          working_hours: parseFloat(manualWorkHours) || 8.0,
          daily_pay: parseFloat(manualWorkPay) || 0.0,
          status: manualWorkStatus
        })
      });
      if (res.ok) {
        triggerToastGlobal('Manual Shift Logged ✅', 'Staff manual day parameters saved successfully.');
        setManualWorkStaffId('');
        setManualWorkPay('');
        setManualWorkDate('');
        setShowManualAttendanceForm(false);
        fetchAdminAttendance();
      } else {
        const data = await res.json();
        triggerToastGlobal('Failure', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Connection failure creating manual shift log.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDues = async (p) => {
    if (!confirm(`Are you sure you want to mark outstanding payment of ₹${p.due_amount} for ${p.farmer_name} as fully completed?`)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/farmer/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          farmer_id: p.farmer_id,
          procurement_id: p.procurement_id,
          paid_amount: p.due_amount,
          payment_mode: 'upi'
        })
      });
      if (res.ok) {
        triggerToastGlobal('Dues Cleared! 💸', `Payment of ₹${p.due_amount} registered for ${p.farmer_name}.`);
        confetti({ particleCount: 50 });
        fetchPayments();
        fetchDashboardStats();
      } else {
        const data = await res.json();
        triggerToastGlobal('Payment Error', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Error', 'Failed to process payments.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayoutSubmit = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      triggerToastGlobal('Validation Error', 'Please enter a valid payout amount.', 'warning');
      return;
    }

    if (parseFloat(payoutAmount) > selectedPaymentForPayout.due_amount) {
      triggerToastGlobal('Validation Error', `Amount cannot exceed remaining dues of ₹${selectedPaymentForPayout.due_amount}.`, 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/farmer/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          farmer_id: selectedPaymentForPayout.farmer_id,
          procurement_id: selectedPaymentForPayout.procurement_id,
          paid_amount: parseFloat(payoutAmount),
          payment_mode: payoutMode
        })
      });
      if (res.ok) {
        triggerToastGlobal('Payment Cleared! 💸', `INR ${payoutAmount} registered successfully via ${payoutMode.toUpperCase()}.`);
        confetti({ particleCount: 50 });
        setSelectedPaymentForPayout(null);
        setPayoutAmount('');
        fetchPayments();
        fetchPaymentReceipts();
        fetchDashboardStats();
      } else {
        const data = await res.json();
        triggerToastGlobal('Payout Failed', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Error', 'Failed to process payment.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          vehicle_number: newVehicleNo,
          type: newVehicleType,
          assigned_to: newVehicleDriver ? parseInt(newVehicleDriver) : null
        })
      });
      if (res.ok) {
        triggerToastGlobal('Vehicle Added 🚜', `Vehicle ${newVehicleNo} successfully registered.`);
        confetti({ particleCount: 30 });
        setNewVehicleNo('');
        setNewVehicleDriver('');
        setShowAddForm(false);
        fetchVehicles();
        fetchDashboardStats();
      }
    } catch (err) { }
  };

  const handleEditVehicleSave = async (id) => {
    try {
      const res = await fetch(`/api/admin/vehicles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          vehicle_number: editNumber,
          type: editType,
          assigned_to: editDriver ? parseInt(editDriver) : null
        })
      });
      if (res.ok) {
        triggerToastGlobal('Vehicle Updated ✅', 'Specifications successfully updated.');
        setEditingId(null);
        fetchVehicles();
      }
    } catch (err) { }
  };

  const handleDeleteVehicle = async (id, num) => {
    if (!confirm(`Are you sure you want to remove vehicle ${num} from the transport fleet?`)) return;
    try {
      const res = await fetch(`/api/admin/vehicles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        triggerToastGlobal('Vehicle Deleted 🗑️', `${num} removed successfully.`);
        fetchVehicles();
        fetchDashboardStats();
      }
    } catch (err) { }
  };

  // Warehouse Stock CRUD Handlers
  const handleAddCropStock = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          crop_name: newStockCropName,
          current_stock: parseFloat(newStockQty) || 0.0,
          warehouse_location: newStockLocation
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Crop Added 🌾', `${newStockCropName} added to warehouse inventory.`);
        confetti({ particleCount: 30 });
        setNewStockCropName('');
        setNewStockQty('');
        setNewStockLocation('');
        setShowAddCropStockForm(false);
        fetchInventory();
        fetchDashboardStats();
      } else {
        triggerToastGlobal('Add Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Failed to add crop to warehouse.', 'warning');
    }
  };

  const handleEditCropStockSave = async (id) => {
    try {
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          crop_name: editStockName,
          current_stock: parseFloat(editStockQty) || 0.0,
          warehouse_location: editStockLocation
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Stock Updated ✅', 'Crop stock details updated.');
        setEditingStockId(null);
        fetchInventory();
        fetchDashboardStats();
      } else {
        triggerToastGlobal('Update Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Failed to update crop stock.', 'warning');
    }
  };

  const handleDeleteCropStock = async (id, name) => {
    if (!confirm(`Are you sure you want to delete ${name} from the warehouse inventory?`)) return;
    try {
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Crop Deleted 🗑️', `${name} removed from warehouse inventory.`);
        fetchInventory();
        fetchDashboardStats();
      } else {
        triggerToastGlobal('Delete Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Failed to delete crop stock.', 'warning');
    }
  };

  // Staff CRUD Handlers
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (newStaffPhone.length !== 10) {
      triggerToastGlobal('Validation Error ❌', 'Phone number must be exactly 10 digits.', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: newStaffName,
          phone: newStaffPhone,
          role: newStaffRole,
          pin: newStaffPin || '222222',
          password: newStaffPass || 'staff123',
          pay_rate: 0.0,
          working_hours: 0.0,
          pay_type: 'daily'
        })
      });
      if (res.ok) {
        triggerToastGlobal('Staff Registered! 🧑‍💼', `Staff member ${newStaffName} created successfully.`);
        confetti({ particleCount: 30 });
        setNewStaffName('');
        setNewStaffPhone('');
        setNewStaffPin('');
        setNewStaffPass('');
        setNewStaffPayRate('');
        setNewStaffHours('');
        setShowAddStaffForm(false);
        fetchStaff();
      } else {
        const data = await res.json();
        triggerToastGlobal('Registration Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  const handleEditStaffSave = async (id) => {
    try {
      const payload = {
        name: editStaffName,
        phone: editStaffPhone,
        role: editStaffRole
      };
      if (editStaffPin) payload.pin = editStaffPin;
      if (editStaffPass) payload.password = editStaffPass;

      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        triggerToastGlobal('Staff Account Updated ✅', 'Staff parameters changed.');
        setEditingStaffId(null);
        fetchStaff();
      }
    } catch (e) { }
  };

  const handleDeleteStaff = async (id, name) => {
    if (!confirm(`Are you sure you want to delete staff account for ${name}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        triggerToastGlobal('Staff Account Deleted 🗑️', `${name} has been removed.`);
        fetchStaff();
      }
    } catch (e) { }
  };

  const handleRecordPayout = async (staffId, staffName) => {
    const amountStr = prompt(`Enter payout amount for ${staffName} (₹):`);
    if (amountStr === null) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      triggerToastGlobal('Invalid Payout', 'Please enter a valid positive number.', 'warning');
      return;
    }
    const reason = prompt(`Enter reason / notes for this payout (optional):`, `Manual payout to ${staffName}`);
    try {
      const res = await fetch(`/api/admin/users/${staffId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount, reason })
      });
      if (res.ok) {
        triggerToastGlobal('Payout Logged! 💸', `INR ${amount.toLocaleString('en-IN')} paid to ${staffName}.`);
        fetchStaff();
        fetchDashboardStats();
      } else {
        const data = await res.json();
        triggerToastGlobal('Payout Failed', data.message, 'warning');
      }
    } catch (e) {
      triggerToastGlobal('Connection Error', 'Failed to reach backend server.', 'warning');
    }
  };

  // Operational Costs logging Handlers
  const handleLogCost = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          cost_type: newCostType,
          amount: parseFloat(newCostAmount) || 0.0,
          note: newCostNote
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Expense Logged 💸', 'Operational expense successfully registered.');
        setNewCostAmount('');
        setNewCostNote('');
        setShowLogCostForm(false);
        fetchOperationalCosts();
        fetchDashboardStats();
      } else {
        triggerToastGlobal('Log Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  const handleLogFuel = async (e) => {
    e.preventDefault();
    if (!fuelLogVehicleNumber) {
      triggerToastGlobal('Validation Error ❌', 'Please enter a vehicle number.', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/admin/vehicles/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          vehicle_number: fuelLogVehicleNumber,
          fuel_expense: parseFloat(fuelLogFuel) || 0.0
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Fuel Logged 🚜', 'Fuel logs updated successfully.');
        setFuelLogFuel('');
        setFuelLogVehicleNumber('');
        setShowLogFuelForm(false);
        fetchVehicles();
        fetchDashboardStats();
      } else {
        triggerToastGlobal('Log Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  // Farmer CRUD Handlers for Admin
  const handleAddFarmer = async (e) => {
    e.preventDefault();
    if (newFarmerPhone.length !== 10) {
      triggerToastGlobal('Validation Error ❌', 'Phone number must be exactly 10 digits.', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: newFarmerName,
          phone: newFarmerPhone,
          role: 'farmer',
          password: newFarmerPass || 'farmer123',
          village: newFarmerVillage,
          address: newFarmerAddress,
          upi_id: newFarmerUpi
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Farmer Registered! 🌾', `Farmer ${newFarmerName} created successfully.`);
        confetti({ particleCount: 30 });
        setNewFarmerName('');
        setNewFarmerPhone('');
        setNewFarmerVillage('');
        setNewFarmerAddress('');
        setNewFarmerUpi('');
        setNewFarmerPass('');
        fetchFarmers();
      } else {
        triggerToastGlobal('Registration Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  const handleEditFarmerSave = async (id) => {
    if (editFarmerPhone.length !== 10) {
      triggerToastGlobal('Validation Error ❌', 'Phone number must be exactly 10 digits.', 'warning');
      return;
    }
    try {
      const payload = {
        name: editFarmerName,
        phone: editFarmerPhone,
        village: editFarmerVillage,
        address: editFarmerAddress,
        upi_id: editFarmerUpi
      };
      if (editFarmerPass) payload.password = editFarmerPass;

      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Farmer Profile Updated ✅', `${editFarmerName}'s specifications updated.`);
        setEditingFarmerId(null);
        fetchFarmers();
      } else {
        triggerToastGlobal('Update Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  const handleDeleteFarmer = async (id, name) => {
    if (!confirm(`Are you sure you want to delete farmer ${name}? This will remove all their active dues, receipts, and user account.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal('Farmer Deleted 🗑️', `${name} removed successfully.`);
        fetchFarmers();
      } else {
        triggerToastGlobal('Delete Failed', data.message, 'warning');
      }
    } catch (err) { }
  };

  const handleToggleUserActiveStatus = async (userId, userName, currentStatus) => {
    const nextStatus = !currentStatus;
    const actionText = nextStatus ? 'reactivate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${actionText} the account of ${userName}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ is_active: nextStatus })
      });
      const data = await res.json();
      if (res.ok) {
        triggerToastGlobal(
          nextStatus ? 'Account Activated! 🟢' : 'Account Deactivated! 🔴',
          `${userName} has been successfully ${nextStatus ? 'reactivated' : 'deactivated'}.`
        );
        fetchFarmers();
        fetchStaff();
      } else {
        triggerToastGlobal('Action Failed', data.message, 'warning');
      }
    } catch (err) {
      triggerToastGlobal('Error', 'Connection failed.', 'warning');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 lg:space-y-2 lg:col-span-1">
        <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'dashboard' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Wheat size={16} />
          {translate('dashboard')}
        </button>
        <button onClick={() => setActiveTab('prices')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'prices' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <DollarSign size={16} />
          {translate('priceBoard')}
        </button>
        <button onClick={() => setActiveTab('dues')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'dues' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Wallet size={16} />
          Dues & Payments
        </button>
        <button onClick={() => setActiveTab('slips')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'slips' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <FileText size={16} />
          Weighing Slips
        </button>
        <button onClick={() => setActiveTab('procure')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'procure' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Scale size={16} />
          Weighing Slip Maker
        </button>
        <button onClick={() => setActiveTab('recovery')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'recovery' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <HelpCircle size={16} />
          Recovery Requests
        </button>
        <button onClick={() => setActiveTab('vehicles')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'vehicles' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Truck size={16} />
          Fleet CRUD
        </button>
        <button onClick={() => setActiveTab('sales')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'sales' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Truck size={16} />
          {translate('logSale')}
        </button>
        <button onClick={() => setActiveTab('staff')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'staff' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Users size={16} />
          {translate('staffControl')}
        </button>
        <button onClick={() => setActiveTab('farmers')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'farmers' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <Users size={16} />
          Farmers Management
        </button>
        <button onClick={() => setActiveTab('chat')} className={`w-full text-left p-3 rounded-xl flex items-center justify-between border font-bold text-sm transition ${activeTab === 'chat' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <div className="flex items-center gap-2">
            <MessageSquare size={16} />
            {translate('helpline')}
          </div>
          {totalAdminUnreadCount > 0 && activeTab !== 'chat' && (
            <span className="bg-red-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full animate-bounce">
              {totalAdminUnreadCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('profile')} className={`w-full text-left p-3 rounded-xl flex items-center gap-2 border font-bold text-sm transition ${activeTab === 'profile' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900'}`}>
          <User size={16} />
          My Profile
        </button>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-emerald-500">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">{translate('netProfit')}</span>
                <h3 className={`font-display font-extrabold text-xl mt-1 ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ₹{stats.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </h3>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-blue-500">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">TOTAL REVENUE</span>
                <h3 className="font-display font-extrabold text-xl text-white mt-1">₹{stats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-rose-500">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">TOTAL EXPENSES</span>
                <h3 className="font-display font-extrabold text-xl text-slate-200 mt-1">₹{stats.totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
              </div>
              <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-amber-500">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">FARMER OUTSTANDING DUES</span>
                <h3 className="font-display font-extrabold text-xl text-amber-400 mt-1">₹{stats.farmerOutstandingDues.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-display font-extrabold text-base text-white mb-4 flex items-center gap-2">
                <Scale className="text-emerald-400" size={18} />
                {translate('activeStock')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {inventory.map((inv) => (
                  <div key={inv.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{inv.crop_name}</h4>
                    </div>
                    <div className="text-right">
                      <span className="font-display font-extrabold text-sm text-emerald-400">{inv.current_stock.toFixed(2)} Qtl</span>
                      <p className="text-[9px] text-slate-500 mt-0.5">{inv.warehouse_location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-display font-extrabold text-base text-white mb-4">Farmer Pickup Review</h3>
              {pickups.filter(p => p.status === 'pending').length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No logistics requests pending review.</p>
              ) : (
                <div className="space-y-4">
                  {pickups.filter(p => p.status === 'pending').map((p) => (
                    <div key={p.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-white">{p.farmer_name} ({p.farmer_village})</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Crop: {p.crop_name} | Est Qty: {p.estimated_quantity} Qtl | Date: {p.pickup_date}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <select
                          id={`emp-select-${p.id}`}
                          className="bg-slate-950 border border-slate-800 text-xs rounded-lg p-2 text-slate-300 outline-none"
                          defaultValue=""
                        >
                          <option value="" disabled>Select Employee</option>
                          {staff.filter(s => s.role === 'employee' || s.role === 'supervisor' || s.role === 'admin').map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <select
                          id={`wrk-select-${p.id}`}
                          className="bg-slate-950 border border-slate-800 text-xs rounded-lg p-2 text-slate-300 outline-none"
                          defaultValue=""
                        >
                          <option value="" disabled>Select Worker Driver</option>
                          {staff.filter(s => s.role === 'worker').map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const empVal = document.getElementById(`emp-select-${p.id}`).value;
                            const wrkVal = document.getElementById(`wrk-select-${p.id}`).value;
                            if (!empVal || !wrkVal) {
                              triggerToastGlobal('Selection Required ⚠️', 'Please select both an employee and a worker driver.', 'warning');
                              return;
                            }
                            handlePickupApprove(p.id, empVal, wrkVal);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition outline-none"
                        >
                          Approve & Dispatch
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-display font-extrabold text-base text-white mb-4 flex items-center gap-2">
                <Truck className="text-emerald-500" size={18} />
                Fleet log metrics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicles.map((v) => (
                  <div key={v.id} className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{v.vehicle_number}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{v.type} | Driver: {v.assigned_to_name}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-red-400 font-bold">₹{v.fuel_expense.toLocaleString('en-IN')}</span>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Fuel Cost</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="font-display font-extrabold text-base text-white mb-4">Send Global Push Alert</h3>
              <form onSubmit={handleSendBroadcast} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs items-end">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Alert Title</label>
                  <input type="text" value={bTitle} onChange={e => setBTitle(e.target.value)} placeholder="e.g. Mandi Holiday Alert" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Alert Message</label>
                  <input type="text" value={bMsg} onChange={e => setBMsg(e.target.value)} placeholder="Mandi closed tomorrow for maintenance." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" required />
                </div>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg cursor-pointer text-center select-none">
                  Transmit Broadcast
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'prices' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl lg:col-span-1">
              <h3 className="font-display font-extrabold text-base text-white mb-4">Set Buy Rate</h3>
              <form onSubmit={handleUpdatePrice} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Select Crop</label>
                  <select value={cropName} onChange={e => setCropName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white">
                    {prices.map((p) => (
                      <option key={p.id} value={p.crop_name}>{p.crop_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Rate per Quintal (₹)</label>
                  <input type="number" value={priceVal} onChange={e => setPriceVal(e.target.value)} placeholder="e.g. 2300" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">New Crop Name</label>
                  <input type="text" value={newCropName} onChange={e => setNewCropName(e.target.value)} placeholder="e.g. Maize" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white" />
                  <span className="text-[9px] text-slate-500 mt-1 block font-semibold">Leave empty to update selected crop.</span>
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg mt-2 cursor-pointer transition">
                  Set Live Price
                </button>
              </form>
              <div className="mt-6 space-y-3">
                <h4 className="font-display font-extrabold text-sm text-white">Active Crop Board</h4>
                {prices.map((p) => (
                  <div key={p.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-white">{p.crop_name}</span>
                      <p className="text-slate-400 mt-0.5">INR {Number(p.price_per_quintal || 0).toLocaleString('en-IN')} / Qtl</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCrop(p)}
                      className="p-2 bg-red-950/40 hover:bg-red-900/40 border border-red-900/50 text-red-400 rounded-lg cursor-pointer transition"
                      title="Remove crop"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
              <h3 className="font-display font-extrabold text-base text-white">AI Price Suggestions</h3>
              <p className="text-xs text-slate-400">Historical margin analysis. Rates generated to clear margins and maintain steady inventory flow.</p>
              <div className="space-y-4">
                {aiSuggestions.map((trend) => (
                  <div key={trend.crop_name} className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold text-white">{trend.crop_name}</h4>
                      <span className="text-xs font-bold text-amber-400">AI Suggested: ₹{trend.ai_suggested_rate}</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed font-light">{trend.reason}</p>
                    <div className="flex gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider pt-1.5 border-t border-slate-850">
                      <span>Avg Buy: ₹{trend.current_buy_rate.toFixed(0)}</span>
                      <span>Avg Sell: ₹{trend.recent_sell_rate.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dues' && (
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="font-display font-extrabold text-xl text-white">Outstanding Farmer Dues</h3>
              <p className="text-xs text-slate-400 mt-1">Audit all farmer procurements, log partial payouts, and support multiple payment gateways.</p>
            </div>

            {selectedPaymentForPayout && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 text-xs space-y-4 max-w-lg animate-slide-up">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                  <h4 className="font-display font-extrabold text-sm text-white">Process Custom Payout</h4>
                  <button onClick={() => setSelectedPaymentForPayout(null)} className="text-slate-500 hover:text-slate-400 font-bold text-[10px] uppercase tracking-wider cursor-pointer">Cancel</button>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Target Farmer</span>
                  <p className="font-bold text-white text-sm">{selectedPaymentForPayout.farmer_name} ({selectedPaymentForPayout.farmer_village})</p>
                  <p className="text-slate-400">Slip ID: <span className="font-mono text-emerald-400 font-bold">{selectedPaymentForPayout.slip_id}</span> | Crop: {selectedPaymentForPayout.crop_name}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Payment Method *</label>
                    <select
                      value={payoutMode}
                      onChange={e => setPayoutMode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                    >
                      <option value="upi">UPI Transfer</option>
                      <option value="cash">Cash Payment</option>
                      <option value="bank">Bank Wire Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Amount to Pay (₹) *</label>
                    <input
                      type="number"
                      max={selectedPaymentForPayout.due_amount}
                      value={payoutAmount}
                      onChange={e => setPayoutAmount(e.target.value)}
                      placeholder={`Max: ₹${selectedPaymentForPayout.due_amount}`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                      required
                    />
                    <span className="text-[9px] text-slate-500 mt-1 block font-semibold">Remaining due: ₹{selectedPaymentForPayout.due_amount}</span>
                  </div>
                </div>
                <button
                  onClick={handleProcessPayoutSubmit}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg mt-2 cursor-pointer transition select-none flex items-center justify-center gap-1.5 disabled:opacity-50"
                  disabled={loading}
                >
                  Confirm Payout Transaction
                </button>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-3.5">Farmer</th>
                    <th className="p-3.5">Slip / Crop / Qty</th>
                    <th className="p-3.5">Total Expectation</th>
                    <th className="p-3.5">Amount Paid</th>
                    <th className="p-3.5">Outstanding Due</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/20">
                      <td className="p-3.5">
                        <span className="font-bold text-white block">{p.farmer_name}</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{p.farmer_village} | {p.farmer_phone}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-emerald-400 block">{p.slip_id}</span>
                        <span className="text-slate-400 block mt-0.5">{p.crop_name} - {p.quintals ? `${p.quintals.toFixed(2)} Qtl` : 'N/A'}</span>
                      </td>
                      <td className="p-3.5 font-bold">₹{p.total_amount.toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-emerald-400">₹{p.paid_amount.toLocaleString('en-IN')}</td>
                      <td className="p-3.5 font-bold text-amber-400">₹{p.due_amount.toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-center">
                        {p.due_amount > 0 ? (
                          <button
                            onClick={() => {
                              setSelectedPaymentForPayout(p);
                              setPayoutAmount(p.due_amount);
                              setPayoutMode('upi');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg cursor-pointer transition select-none"
                          >
                            Process Payment
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleShowLatestPaymentReceipt(p.procurement_id)}
                              className="text-[10px] bg-emerald-950/50 hover:bg-emerald-900 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-900/50 font-bold uppercase tracking-wider cursor-pointer transition"
                              title="Click to view latest paid slip receipt info"
                            >
                              Paid ✅
                            </button>
                            <button
                              onClick={() => handleDownloadSettlementReceipt(p.procurement_id)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg border border-slate-700 transition cursor-pointer"
                              title="Download Settlement Receipt"
                            >
                              <Download size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <h4 className="font-display font-extrabold text-base text-white">Payment Receipts</h4>
              {paymentReceipts.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-5 border border-slate-800 rounded-xl">No payment receipts have been issued yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {paymentReceipts.map((receipt) => (
                    <div key={receipt.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 text-xs flex items-center justify-between gap-4">
                      <div>
                        <span className="font-bold text-emerald-400">{receipt.receipt_no}</span>
                        {(receipt.receipt_type || '') === 'settlement' && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-800 text-emerald-300 bg-emerald-950/50 font-bold uppercase tracking-wide">
                            Full Payment
                          </span>
                        )}
                        <h5 className="text-sm font-bold text-white mt-1">{receipt.farmer_name} | {receipt.slip_id || 'N/A'}</h5>
                        <p className="text-slate-400 mt-0.5">Paid: INR {Number(receipt.amount_paid || 0).toLocaleString('en-IN')} | Due: INR {Number(receipt.due_after || 0).toLocaleString('en-IN')}</p>
                      </div>
                      <button
                        onClick={() => downloadPaymentReceiptPDF(receipt)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl border border-slate-700 transition cursor-pointer"
                        title="Download payment receipt"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'slips' && (
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="font-display font-extrabold text-xl text-white font-sans">Weighing Slips & Peer Correction</h3>
              <p className="text-xs text-slate-400 mt-1">
                View, download, and propose corrections to digital weighing slips. Slips can only be updated after the respective farmer approves the proposed changes.
              </p>
            </div>

            {selectedSlipForEdit && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 text-xs space-y-4 animate-slide-up">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                  <h4 className="font-display font-extrabold text-sm text-white flex items-center gap-2">
                    <Edit2 size={16} className="text-amber-400" />
                    Propose Corrections for {selectedSlipForEdit.slip_id}
                  </h4>
                  <button onClick={() => setSelectedSlipForEdit(null)} className="text-slate-500 hover:text-slate-400 font-bold text-[10px] uppercase tracking-wider cursor-pointer">Cancel</button>
                </div>

                <form onSubmit={handleProposeEditSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5 font-sans">Total Weight (Quintals) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editSlipWeight || ''}
                        onChange={e => setEditSlipWeight(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                        required
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block font-semibold">Original: {selectedSlipForEdit.quintals} Qtl</span>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5 font-sans">Rate per Quintal (₹) *</label>
                      <input
                        type="number"
                        value={editSlipRate || ''}
                        onChange={e => setEditSlipRate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                        required
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block font-semibold">Original: ₹{selectedSlipForEdit.rate_per_quintal}</span>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5 font-sans">Bag Count *</label>
                      <input
                        type="number"
                        value={editSlipBags || ''}
                        onChange={e => setEditSlipBags(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                        required
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block font-semibold">Original: {selectedSlipForEdit.bag_count} bags</span>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5 font-sans">Deductions Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editSlipDeductions || ''}
                        onChange={e => setEditSlipDeductions(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block font-semibold">Original: ₹{Number(selectedSlipForEdit.deductions || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="text-xs">
                      <span className="text-slate-400 block font-semibold">Calculated Expected Payout comparison:</span>
                      <div className="flex gap-4 mt-1 font-bold">
                        <span className="text-slate-500 font-normal">Original: <span className="text-white font-semibold">₹{selectedSlipForEdit.total_payout?.toLocaleString('en-IN')}</span></span>
                        <span className="text-emerald-400">Proposed: <span>₹{((parseFloat(editSlipWeight || 0) * parseFloat(editSlipRate || 0)) - parseFloat(editSlipDeductions || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-lg cursor-pointer transition select-none flex-grow sm:flex-grow-0"
                    >
                      Propose Corrections
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-3.5">Slip ID / Date</th>
                    <th className="p-3.5">Farmer</th>
                    <th className="p-3.5">Crop Details</th>
                    <th className="p-3.5">Expected Pay</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {procurements.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">No digital weighing slips found in the registry.</td>
                    </tr>
                  ) : (
                    procurements.map((slip) => (
                      <tr key={slip.id} className="hover:bg-slate-900/20">
                        <td className="p-3.5">
                          <span className="font-bold text-emerald-400 block">{slip.slip_id}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{new Date(slip.created_at).toLocaleDateString()}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-white block">{slip.farmer_name}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{slip.farmer_village}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-semibold block">{slip.crop_name}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Weight: {slip.quintals.toFixed(2)} Qtl | Bags: {slip.bag_count} | Deducted: ₹{Number(slip.deductions || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold">₹{slip.total_payout.toLocaleString('en-IN')}</td>
                        <td className="p-3.5">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${slip.edit_status === 'none' ? 'bg-slate-950 text-slate-400 border-slate-800' :
                              slip.edit_status === 'pending_farmer_approval' ? 'bg-amber-950/40 text-amber-400 border-amber-900/50 animate-pulse-slow' :
                                slip.edit_status === 'approved' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' :
                                  'bg-red-950/40 text-red-400 border-red-900/50'
                            }`}>
                            {slip.edit_status === 'none' ? 'No Edits' :
                              slip.edit_status === 'pending_farmer_approval' ? 'Pending Approval' :
                                slip.edit_status === 'approved' ? 'Approved' : 'Rejected'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex gap-2 justify-center items-center">
                            <button
                              onClick={() => downloadReceiptPDF(slip)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded border border-slate-700 transition cursor-pointer"
                              title="Download PDF Receipt"
                            >
                              <Download size={14} />
                            </button>
                            {slip.edit_status !== 'pending_farmer_approval' ? (
                              <button
                                onClick={() => {
                                  setSelectedSlipForEdit(slip);
                                  setEditSlipWeight(slip.quintals);
                                  setEditSlipRate(slip.rate_per_quintal);
                                  setEditSlipBags(slip.bag_count);
                                  setEditSlipDeductions(slip.deductions);
                                }}
                                className="bg-amber-950 text-amber-400 hover:bg-amber-900 border border-amber-900 font-bold text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded transition select-none cursor-pointer"
                              >
                                Edit Slip
                              </button>
                            ) : (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleForceRespondEdit(slip.id, 'approve')}
                                  className="bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-900 font-bold text-[9px] uppercase tracking-wider px-2 py-1 rounded transition select-none cursor-pointer"
                                  title="Force Apply Edits immediately without waiting for farmer approval"
                                >
                                  Force Approve
                                </button>
                                <button
                                  onClick={() => handleForceRespondEdit(slip.id, 'reject')}
                                  className="bg-red-950 text-red-400 hover:bg-red-900 border border-red-900 font-bold text-[9px] uppercase tracking-wider px-2 py-1 rounded transition select-none cursor-pointer"
                                  title="Cancel/Withdraw Proposed correction"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                <div>
                  <h3 className="font-display font-extrabold text-lg text-white">Logistics & Fleet Manager</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Control transport vehicles, designating driver assignments, fuel expense logs, and mileage metrics.</p>
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition select-none flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  {showAddForm ? 'Close Editor' : 'Register Vehicle'}
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleAddVehicle} className="glass-panel p-6 rounded-2xl text-xs space-y-4 animate-slide-up border border-slate-800 bg-slate-900/40 max-w-xl">
                  <h4 className="font-bold text-sm text-white">Register New Fleet Asset</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Vehicle Number *</label>
                      <input type="text" value={newVehicleNo} onChange={e => setNewVehicleNo(formatIndianVehicleNumber(e.target.value))} placeholder="e.g. HR-56-Y-7890" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono" required />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Type *</label>
                      <select value={newVehicleType} onChange={e => setNewVehicleType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white">
                        <option value="Tractor Trolley">Tractor Trolley</option>
                        <option value="Mahindra Pickup">Mahindra Pickup</option>
                        <option value="Truck (6-Wheeler)">Truck (6-Wheeler)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Assign Driver</label>
                      <select value={newVehicleDriver} onChange={e => setNewVehicleDriver(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white">
                        <option value="">No Driver Assigned</option>
                        {staff.filter(s => s.role === 'worker').map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg cursor-pointer transition select-none">
                    Save Vehicle specifications
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicles.map((v) => {
                  const isEditing = editingId === v.id;
                  return (
                    <div key={v.id} className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between gap-4">
                      {isEditing ? (
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Plate Number</label>
                            <input type="text" value={editNumber} onChange={e => setEditNumber(formatIndianVehicleNumber(e.target.value))} className="bg-slate-950 border border-slate-800 rounded p-1.5 text-white font-mono w-full" />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Vehicle Class</label>
                            <select value={editType} onChange={e => setEditType(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-1.5 text-white w-full">
                              <option value="Tractor Trolley">Tractor Trolley</option>
                              <option value="Mahindra Pickup">Mahindra Pickup</option>
                              <option value="Truck (6-Wheeler)">Truck (6-Wheeler)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Designated Driver</label>
                            <select value={editDriver} onChange={e => setEditDriver(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-1.5 text-white w-full">
                              <option value="">No Driver</option>
                              {staff.filter(s => s.role === 'worker').map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className="text-base font-extrabold text-white">{v.vehicle_number}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{v.type} | Driver: {v.assigned_to_name || 'Unassigned'}</p>
                          <div className="flex gap-4 mt-3 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Fuel Cost</span>
                              <p className="font-semibold text-red-400 mt-0.5">₹{v.fuel_expense.toLocaleString('en-IN')}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 border-t border-slate-850 pt-3 text-xs">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleEditVehicleSave(v.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg transition"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1 rounded-lg transition"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(v.id);
                                setEditNumber(v.vehicle_number);
                                setEditType(v.type);
                                setEditDriver(v.assigned_to || '');
                              }}
                              className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteVehicle(v.id, v.vehicle_number)}
                              className="text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              {/* Card 1: Log Vehicle Fuel Expense */}
              <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800 bg-slate-900/40">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h3 className="font-display font-extrabold text-sm text-white flex items-center gap-1.5"><Truck size={14} className="text-emerald-400" /> Log Fuel Expense</h3>
                </div>
                <form onSubmit={handleLogFuel} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Vehicle Plate Number *</label>
                    <input
                      type="text"
                      list="fleet-vehicles"
                      value={fuelLogVehicleNumber}
                      onChange={e => setFuelLogVehicleNumber(formatIndianVehicleNumber(e.target.value))}
                      placeholder="e.g. HR-56-Y-7890"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                      required
                    />
                    <datalist id="fleet-vehicles">
                      {vehicles.map(v => (
                        <option key={v.id} value={v.vehicle_number}>{v.type}</option>
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Fuel Expense (₹) *</label>
                    <input
                      type="number"
                      value={fuelLogFuel}
                      onChange={e => setFuelLogFuel(e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                      required
                    />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition cursor-pointer select-none">
                    Log Fuel Expense
                  </button>
                </form>
              </div>

              {/* Card 2: Log Mandi/Operational Expenses */}
              <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800 bg-slate-900/40">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h3 className="font-display font-extrabold text-sm text-white flex items-center gap-1.5"><DollarSign size={14} className="text-emerald-400" /> Log Operational Cost</h3>
                </div>
                <form onSubmit={handleLogCost} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Cost Classification *</label>
                    <select value={newCostType} onChange={e => setNewCostType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white">
                      <option value="Fuel">Fuel (General Warehouse)</option>
                      <option value="Labor">Mandi Labor/Loading</option>
                      <option value="Transport">Tractor/Logistics Rental</option>
                      <option value="Maintenance">Equipment Maintenance</option>
                      <option value="Office">Office Operations</option>
                      <option value="Other">Other Miscellaneous</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      value={newCostAmount}
                      onChange={e => setNewCostAmount(e.target.value)}
                      placeholder="e.g. 3500"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Expense Memo / Note</label>
                    <input
                      type="text"
                      value={newCostNote}
                      onChange={e => setNewCostNote(e.target.value)}
                      placeholder="e.g. Mandi yard sweeping"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition cursor-pointer select-none">
                    Register Operational Cost
                  </button>
                </form>
              </div>

              {/* Card 3: Recent Expenses Ledger */}
              <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800 bg-slate-900/40">
                <h3 className="font-display font-extrabold text-sm text-white border-b border-slate-800 pb-2">Recent Operating Ledger</h3>
                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                  {operationalCosts.length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-4">No recent general expenses logged.</p>
                  ) : (
                    operationalCosts.slice(0, 5).map(c => (
                      <div key={c.id} className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-900 flex justify-between items-center text-[11px]">
                        <div>
                          <span className="font-bold text-slate-300 block">{c.cost_type}</span>
                          <span className="text-[9px] text-slate-500 block">{c.note || 'No note'}</span>
                        </div>
                        <span className="font-bold text-red-400">₹{c.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl lg:col-span-1">
              <h3 className="font-display font-extrabold text-base text-white mb-4">Outward Market Sale</h3>
              <form onSubmit={handleLogSale} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Select Crop</label>
                  <select value={saleCrop} onChange={e => setSaleCrop(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white">
                    {prices.map((p) => (
                      <option key={p.id} value={p.crop_name}>{p.crop_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Buyer Name</label>
                  <input type="text" value={saleBuyer} onChange={e => setSaleBuyer(e.target.value)} placeholder="e.g. Adani Logistics" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Quantity (Quintals)</label>
                  <input type="number" value={saleQty} onChange={e => setSaleQty(e.target.value)} placeholder="e.g. 30.5" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Sale price / Quintal (₹)</label>
                  <input type="number" value={saleRate} onChange={e => setSaleRate(e.target.value)} placeholder="e.g. 2450" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Vehicle Number</label>
                  <input type="text" value={saleTruck} onChange={e => setSaleTruck(formatIndianVehicleNumber(e.target.value))} placeholder="e.g. HR-55-A-1299" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg mt-2 cursor-pointer transition">
                  Dispatch & log sales
                </button>
              </form>
            </div>

            <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <div>
                  <h3 className="font-display font-extrabold text-base text-white">Active Stock Logs</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Manage warehouse stock levels, add new crops, or delete inactive inventory lines.</p>
                </div>
                <button
                  onClick={() => {
                    setShowAddCropStockForm(!showAddCropStockForm);
                    setEditingStockId(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg cursor-pointer transition select-none flex items-center gap-1"
                >
                  <Plus size={12} />
                  {showAddCropStockForm ? 'Close Form' : 'Add New Crop'}
                </button>
              </div>

              {showAddCropStockForm && (
                <form onSubmit={handleAddCropStock} className="bg-slate-950 p-4 rounded-xl border border-emerald-500/35 space-y-3 text-xs animate-slide-up">
                  <h4 className="font-bold text-emerald-400 flex items-center gap-1.5"><Wheat size={14} /> Add Crop to Warehouse</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Crop Name *</label>
                      <input
                        type="text"
                        value={newStockCropName}
                        onChange={e => setNewStockCropName(e.target.value)}
                        placeholder="e.g. Mustard"
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Current Stock (Quintals) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newStockQty}
                        onChange={e => setNewStockQty(e.target.value)}
                        placeholder="e.g. 15.50"
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Warehouse Location *</label>
                      <input
                        type="text"
                        value={newStockLocation}
                        onChange={e => setNewStockLocation(e.target.value)}
                        placeholder="e.g. Block-B"
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition select-none cursor-pointer">
                    Save New Crop Stock
                  </button>
                </form>
              )}

              <div className="space-y-3">
                {inventory.map(inv => {
                  const isEditing = editingStockId === inv.id;
                  return (
                    <div key={inv.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-xs">
                      {isEditing ? (
                        <div className="w-full space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Crop Name</label>
                              <input
                                type="text"
                                value={editStockName}
                                onChange={e => setEditStockName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Stock Quantity (Qtl)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={editStockQty}
                                onChange={e => setEditStockQty(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Location</label>
                              <input
                                type="text"
                                value={editStockLocation}
                                onChange={e => setEditStockLocation(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingStockId(null)}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold text-[10px] transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleEditCropStockSave(inv.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] transition cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-grow">
                            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                              <Wheat size={14} className="text-emerald-500" />
                              {inv.crop_name}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Location: {inv.warehouse_location}</p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <span className="font-display font-extrabold text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-1 rounded-lg">
                              {inv.current_stock.toFixed(2)} Quintals
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingStockId(inv.id);
                                  setEditStockName(inv.crop_name);
                                  setEditStockQty(inv.current_stock);
                                  setEditStockLocation(inv.warehouse_location);
                                  setShowAddCropStockForm(false);
                                }}
                                className="p-1.5 bg-slate-800/80 hover:bg-slate-800 hover:text-white text-slate-400 rounded-lg transition cursor-pointer"
                                title="Edit Stock Level"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteCropStock(inv.id, inv.crop_name)}
                                className="p-1.5 bg-red-950/40 border border-red-900/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-lg transition cursor-pointer"
                                title="Delete Crop entirely"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'farmers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                <div>
                  <h3 className="font-display font-extrabold text-lg text-white">Farmers Management</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Search directory of registered farmers, modify their profile details, adjust UPI IDs, or delete accounts.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                <Search size={16} className="text-slate-500" />
                <input
                  type="text"
                  value={farmersSearchTerm}
                  onChange={(e) => setFarmersSearchTerm(e.target.value)}
                  onKeyUp={fetchFarmers}
                  placeholder="Search by farmer name, phone number, or village..."
                  className="bg-transparent border-none outline-none text-xs text-white w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
                {farmers.length === 0 ? (
                  <p className="text-center text-slate-500 py-12 md:col-span-2">No farmers found in directory.</p>
                ) : (
                  farmers.map(f => (
                    <div key={f.id} className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between gap-4">
                      <div>
                        <h4 className="text-base font-extrabold text-white flex items-center justify-between gap-1.5">
                          <span className="flex items-center gap-1.5">
                            <User size={14} className="text-emerald-500" />
                            {f.name}
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${f.is_active ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' : 'bg-red-950/40 text-red-400 border-red-900/50'
                            }`}>
                            {f.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Village: {f.village}</p>

                        <div className="mt-3 space-y-1.5 text-slate-300">
                          <p><strong className="text-slate-500">Phone:</strong> <span className="font-mono">{f.phone}</span></p>
                          <p><strong className="text-slate-500">UPI ID:</strong> <span className="font-mono text-emerald-400">{f.upi_id || 'Not Set'}</span></p>
                          <p><strong className="text-slate-500">Field Address:</strong> {f.address || 'Not Set'}</p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 border-t border-slate-850 pt-3 text-xs">
                        <button
                          onClick={() => handleToggleUserActiveStatus(f.id, f.name, f.is_active)}
                          className={`${f.is_active ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'} font-semibold cursor-pointer`}
                        >
                          {f.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingFarmerId(f.id);
                            setEditFarmerName(f.name);
                            setEditFarmerPhone(f.phone);
                            setEditFarmerVillage(f.village);
                            setEditFarmerAddress(f.address || '');
                            setEditFarmerUpi(f.upi_id || '');
                            setEditFarmerPass('');
                          }}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                        >
                          Edit Profile
                        </button>
                        <button
                          onClick={() => handleDeleteFarmer(f.id, f.name)}
                          className="text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              {editingFarmerId ? (
                <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4 animate-slide-up">
                  <h3 className="font-display font-extrabold text-base text-white">Edit Farmer Profile</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleEditFarmerSave(editingFarmerId); }} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
                      <input type="text" value={editFarmerName} onChange={e => setEditFarmerName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" required />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Phone Number *</label>
                      <input type="text" maxLength={10} value={editFarmerPhone} onChange={e => setEditFarmerPhone(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono" required />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Village Name *</label>
                      <input type="text" value={editFarmerVillage} onChange={e => setEditFarmerVillage(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" required />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">UPI ID for payouts</label>
                      <input type="text" value={editFarmerUpi} onChange={e => setEditFarmerUpi(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono" />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Field Address</label>
                      <textarea value={editFarmerAddress} onChange={e => setEditFarmerAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" rows={2} />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Reset Password</label>
                      <input type="password" value={editFarmerPass} onChange={e => setEditFarmerPass(e.target.value)} placeholder="Keep current" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingFarmerId(null)}
                        className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-lg transition cursor-pointer select-none"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition cursor-pointer select-none"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
                  <h3 className="font-display font-extrabold text-base text-white">Register New Farmer</h3>
                  <form onSubmit={handleAddFarmer} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
                      <input type="text" value={newFarmerName} onChange={e => setNewFarmerName(e.target.value)} placeholder="e.g. Suresh Patel" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" required />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Phone Number (10 digits) *</label>
                      <input type="text" maxLength={10} value={newFarmerPhone} onChange={e => setNewFarmerPhone(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 9123456780" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono" required />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Village Name *</label>
                      <input type="text" value={newFarmerVillage} onChange={e => setNewFarmerVillage(e.target.value)} placeholder="e.g. Rampur" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" required />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">UPI ID for payouts</label>
                      <input type="text" value={newFarmerUpi} onChange={e => setNewFarmerUpi(e.target.value)} placeholder="e.g. suresh@upi" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono" />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Field Address</label>
                      <textarea value={newFarmerAddress} onChange={e => setNewFarmerAddress(e.target.value)} placeholder="e.g. Near Tube-well 3" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" rows={2} />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Login Password</label>
                      <input type="password" value={newFarmerPass} onChange={e => setNewFarmerPass(e.target.value)} placeholder="Default: farmer123" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white" />
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition mt-2 cursor-pointer select-none">
                      Register Farmer
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STAFF CRUD & PARAMETERS (PAY RATE & LOGGED HOURS) MANAGEMENT TAB */}
        {activeTab === 'staff' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/40 p-5 rounded-2xl border border-slate-800 gap-4">
              <div>
                <h3 className="font-display font-extrabold text-lg text-white">Staff Operations Management</h3>
                <p className="text-xs text-slate-400 mt-0.5">Register staff members, designate roles, monitor shift clocks, and record custom daily payout feeds.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const nextMode = staffTabMode === 'list' ? 'attendance' : 'list';
                    setStaffTabMode(nextMode);
                    if (nextMode === 'attendance') fetchAdminAttendance();
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition select-none flex items-center gap-1.5"
                >
                  <Clock size={14} />
                  {staffTabMode === 'list' ? 'Daily Pay Feed Ledger' : 'View Staff Accounts List'}
                </button>
                <button
                  onClick={() => setShowAddTaskForm(!showAddTaskForm)}
                  className="bg-purple-800 hover:bg-purple-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition select-none flex items-center gap-1.5"
                >
                  <Calendar size={14} />
                  {showAddTaskForm ? 'Close Dispatcher' : 'Dispatch Custom Duty'}
                </button>
                {staffTabMode === 'list' && (
                  <button
                    onClick={() => setShowAddStaffForm(!showAddStaffForm)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition select-none flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    {showAddStaffForm ? 'Close Editor' : 'Register Staff Member'}
                  </button>
                )}
                {staffTabMode === 'attendance' && (
                  <button
                    onClick={() => setShowManualAttendanceForm(!showManualAttendanceForm)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition select-none flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    {showManualAttendanceForm ? 'Close Shift Logger' : 'Manual Shift Override'}
                  </button>
                )}
              </div>
            </div>

            {/* TASK DISPATCHER FORM */}
            {showAddTaskForm && (
              <form onSubmit={handleAssignTask} className="glass-panel p-6 rounded-2xl text-xs space-y-4 animate-slide-up border border-slate-800 bg-slate-900/40 max-w-xl mb-6">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Calendar size={16} className="text-purple-400" />
                  Dispatch Custom Task / Duty
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Assign to Staff Member *</label>
                    <select
                      value={taskWorkerId}
                      onChange={e => setTaskWorkerId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      required
                    >
                      <option value="">-- Choose Member --</option>
                      {staff.filter(s => s.role === 'worker').map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({translate(s.role)})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Due Date *</label>
                    <input
                      type="date"
                      value={taskDue}
                      onChange={e => setTaskDue(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-300 mb-1.5">Task Title *</label>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={e => setTaskTitle(e.target.value)}
                      placeholder="e.g. Inspect harvest quality at North Farm"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-300 mb-1.5">Detailed Description</label>
                    <textarea
                      value={taskDesc}
                      onChange={e => setTaskDesc(e.target.value)}
                      placeholder="Specify clear instructions for this worker..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white h-20 outline-none"
                    />
                  </div>
                </div>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-6 rounded-lg cursor-pointer transition select-none">
                  Dispatch Task
                </button>
              </form>
            )}

            {/* REGISTER NEW STAFF FORM */}
            {staffTabMode === 'list' && showAddStaffForm && (
              <form onSubmit={handleAddStaff} className="glass-panel p-6 rounded-2xl text-xs space-y-4 animate-slide-up border border-slate-800 bg-slate-900/40 max-w-xl">
                <h4 className="font-bold text-sm text-white">Register New Staff Account</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Full Name *</label>
                    <input type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} placeholder="e.g. Amit Sharma" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" required />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Phone Number (10 digits) *</label>
                    <input type="text" maxLength={10} value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 9876543210" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono" required />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Assign Role *</label>
                    <select value={newStaffRole} onChange={e => setNewStaffRole(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white">
                      <option value="worker">Field Worker (Worker)</option>
                      <option value="employee">Office Operator (Employee)</option>
                      <option value="supervisor">Supervisor (Super-Staff with Admin Powers)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Mandi Login PIN (4-6 digits)</label>
                    <input type="password" value={newStaffPin} onChange={e => setNewStaffPin(e.target.value)} placeholder="e.g. 222222 or 3333" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-300 mb-1.5">Login Password</label>
                    <input type="password" value={newStaffPass} onChange={e => setNewStaffPass(e.target.value)} placeholder="Default: staff123" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
                  </div>
                </div>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-lg cursor-pointer transition select-none">
                  Create Staff Member
                </button>
              </form>
            )}

            {/* MANUAL SHIFT LOGGING FORM FOR OVERRIDES */}
            {staffTabMode === 'attendance' && showManualAttendanceForm && (
              <form onSubmit={handleSaveManualAttendance} className="glass-panel p-6 rounded-2xl text-xs space-y-4 animate-slide-up border border-slate-800 bg-slate-900/40 max-w-xl">
                <h4 className="font-bold text-sm text-white">Manual Daily Shift Override Form</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Select Staff Member *</label>
                    <select value={manualWorkStaffId} onChange={e => setManualWorkStaffId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" required>
                      <option value="">-- Choose Member --</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({translate(s.role)})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Work Date *</label>
                    <input type="date" value={manualWorkDate} onChange={e => setManualWorkDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono" required />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Shift Status *</label>
                    <select value={manualWorkStatus} onChange={e => setManualWorkStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white">
                      <option value="present">Present (Full Shift)</option>
                      <option value="half_day">Half Day Shift</option>
                      <option value="absent">Absent / Off Duty</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Working Hours *</label>
                    <input type="number" step="0.5" value={manualWorkHours} onChange={e => setManualWorkHours(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono" required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-300 mb-1.5">Daily Wage / Pay fed (₹) *</label>
                    <input type="number" value={manualWorkPay} onChange={e => setManualWorkPay(e.target.value)} placeholder="e.g. 1000" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono" required />
                  </div>
                </div>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-lg cursor-pointer transition select-none">
                  Log Shift & Daily Pay
                </button>
              </form>
            )}

            {/* STAFF ACCOUNTS LIST TAB VIEW */}
            {staffTabMode === 'list' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staff.map((s) => {
                  const isEditing = editingStaffId === s.id;
                  return (
                    <div key={s.id} className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between gap-4">
                      {isEditing ? (
                        <div className="w-full space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Full Name</label>
                              <input
                                type="text"
                                value={editStaffName}
                                onChange={e => setEditStaffName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Phone Number</label>
                              <input
                                type="text"
                                maxLength={10}
                                value={editStaffPhone}
                                onChange={e => setEditStaffPhone(e.target.value.replace(/\D/g, ''))}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white font-mono"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Assign Role</label>
                              <select
                                value={editStaffRole}
                                onChange={e => setEditStaffRole(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                              >
                                <option value="worker">Field Worker (Worker)</option>
                                <option value="employee">Office Operator (Employee)</option>
                                <option value="supervisor">Supervisor (Super-Staff with Admin Powers)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Reset PIN (4-6 digits)</label>
                              <input
                                type="password"
                                value={editStaffPin}
                                onChange={e => setEditStaffPin(e.target.value)}
                                placeholder="Keep current"
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Reset Password</label>
                              <input
                                type="password"
                                value={editStaffPass}
                                onChange={e => setEditStaffPass(e.target.value)}
                                placeholder="Keep current"
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end pt-2">
                            <button
                              type="button"
                              onClick={() => setEditingStaffId(null)}
                              className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded font-bold transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditStaffSave(s.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold transition cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <h4 className="text-base font-extrabold text-white flex items-center justify-between gap-1.5">
                              <span className="flex items-center gap-1.5">
                                <User size={14} className="text-emerald-500" />
                                {s.name}
                              </span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${s.is_active ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' : 'bg-red-950/40 text-red-400 border-red-900/50'
                                }`}>
                                {s.is_active ? 'Active' : 'Deactivated'}
                              </span>
                            </h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Role: {translate(s.role)}</p>

                            <div className="mt-3 space-y-1.5 text-slate-300">
                              <p><strong className="text-slate-500">Phone:</strong> <span className="font-mono">{s.phone}</span></p>
                              <p><strong className="text-slate-500">Total Pay Logged:</strong> <span className="font-mono text-emerald-400 font-bold">₹{s.total_payouts.toLocaleString('en-IN')}</span></p>
                            </div>
                          </div>

                          <div className="flex justify-end gap-3 border-t border-slate-850 pt-3 text-xs">
                            <button
                              onClick={() => handleToggleUserActiveStatus(s.id, s.name, s.is_active)}
                              className={`${s.is_active ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'} font-semibold cursor-pointer`}
                            >
                              {s.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button
                              onClick={() => handleRecordPayout(s.id, s.name)}
                              className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                            >
                              Record Payout
                            </button>
                            <button
                              onClick={() => {
                                setEditingStaffId(s.id);
                                setEditStaffName(s.name);
                                setEditStaffPhone(s.phone);
                                setEditStaffRole(s.role);
                                setEditStaffPin('');
                                setEditStaffPass('');
                              }}
                              className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                            >
                              Edit Profile
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(s.id, s.name)}
                              className="text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* DAILY PAY FEED LEDGER VIEW */}
            {staffTabMode === 'attendance' && !showManualAttendanceForm && (
              <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800 bg-slate-900/40">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="font-display font-extrabold text-base text-white">Daily Pay Feed Ledger</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">View logged shifts and enter/modify daily wages for field staff.</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <th className="p-3">Date</th>
                        <th className="p-3">Staff Name</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Shift Status</th>
                        <th className="p-3">Hours Logged</th>
                        <th className="p-3 text-right">Daily Pay (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {adminAttendance.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-500">No shift logs found. Click "Manual Shift Override" to log a shift manually.</td>
                        </tr>
                      ) : (
                        adminAttendance.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-850/40 transition">
                            <td className="p-3 font-mono font-bold text-slate-300">{row.date}</td>
                            <td className="p-3 font-bold text-white">{row.staff_name}</td>
                            <td className="p-3 uppercase text-[10px] text-slate-400 font-bold">{translate(row.staff_role)}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${row.status === 'present'
                                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
                                  : row.status === 'half_day'
                                    ? 'bg-amber-950/40 text-amber-400 border-amber-900/50'
                                    : 'bg-slate-950/40 text-slate-400 border-slate-900'
                                }`}>
                                {row.status === 'present' ? 'Present' : row.status === 'half_day' ? 'Half Day' : 'Absent'}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-300">{row.working_hours} Hrs</td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  defaultValue={row.daily_pay || ''}
                                  placeholder="Feed Pay"
                                  onBlur={(e) => handleSaveDailyPay(row.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveDailyPay(row.id, e.target.value);
                                      e.target.blur();
                                    }
                                  }}
                                  className="bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-white font-mono text-right w-20 outline-none focus:border-emerald-500"
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'procure' && (
          <form onSubmit={handleProcure} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4 shadow-lg">
              <h3 className="font-display font-extrabold text-base text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                <Scale className="text-emerald-400" size={20} />
                Direct Digital Weighing & Slip Generation
              </h3>

              <div className="sm:col-span-2 flex items-center justify-between bg-slate-900/50 border border-slate-800 p-3.5 rounded-xl mb-2">
                <div className="flex flex-col">
                  <span className="text-white font-bold text-xs">Direct Entry (Unregistered Farmer)</span>
                  <span className="text-[10px] text-slate-400">Generate a slip by entering new farmer details inline without pre-registering.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDirectFarmer}
                    onChange={(e) => {
                      setIsDirectFarmer(e.target.checked);
                      if (e.target.checked) {
                        setActiveFarmerId('');
                        setActivePickupId('');
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {isDirectFarmer ? (
                  <>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Farmer Name *</label>
                      <input
                        type="text"
                        value={directFarmerName}
                        onChange={e => setDirectFarmerName(e.target.value)}
                        placeholder="e.g. Ram Singh"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50 transition"
                        required={isDirectFarmer}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Phone Number *</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={directFarmerPhone}
                        onChange={e => setDirectFarmerPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 9876543210"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50 transition font-mono"
                        required={isDirectFarmer}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Village *</label>
                      <input
                        type="text"
                        value={directFarmerVillage}
                        onChange={e => setDirectFarmerVillage(e.target.value)}
                        placeholder="e.g. Gokulpur"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50 transition"
                        required={isDirectFarmer}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Target Farmer *</label>
                      <select
                        value={activeFarmerId}
                        onChange={(e) => setActiveFarmerId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                        required={!isDirectFarmer}
                      >
                        <option value="" disabled>Select Farmer</option>
                        {farmers.map(f => (
                          <option key={f.id} value={f.id}>{f.name} ({f.village})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">Linked Pickup Booking (Optional)</label>
                      <select
                        value={activePickupId}
                        onChange={(e) => {
                          setActivePickupId(e.target.value);
                          const selected = pickups.find(p => p.id === parseInt(e.target.value));
                          if (selected) {
                            setActiveFarmerId(selected.farmer_id);
                            setProcureCropName(selected.crop_name);
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                      >
                        <option value="">No linked booking</option>
                        {pickups.filter(p => p.status !== 'completed').map(p => (
                          <option key={p.id} value={p.id}>{p.crop_name} - {p.farmer_name} ({p.pickup_date})</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Crop Name</label>
                  <select value={procureCropName} onChange={e => setProcureCropName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none">
                    {prices.map((p) => (
                      <option key={p.id} value={p.crop_name}>{p.crop_name}</option>
                    ))}
                    <option value="other">Other (Add New Crop...)</option>
                  </select>
                </div>

                {procureCropName === 'other' && (
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Custom Crop Name *</label>
                    <input
                      type="text"
                      value={customCropName}
                      onChange={e => setCustomCropName(e.target.value)}
                      placeholder="e.g. Mustard"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50 transition font-bold"
                      required={procureCropName === 'other'}
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Rate per Quintal (₹) *</label>
                  <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 2275" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none" required />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Total Weight (Quintals) *</label>
                  <input type="number" step="0.01" value={quintals} onChange={e => setQuintals(e.target.value)} placeholder="e.g. 81.2" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none" required />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Bag Count *</label>
                  <input type="number" value={bags} onChange={e => setBags(e.target.value)} placeholder="e.g. 160" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none" required />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Deductions Amount (₹)</label>
                  <input type="number" step="0.01" value={deductions} onChange={e => setDeductions(e.target.value)} placeholder="e.g. 500" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none" />
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition flex flex-col items-center justify-center text-center gap-3 relative cursor-pointer group pt-4 mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {weightImage ? (
                  <div className="space-y-2">
                    <img src={weightImage} className="max-h-36 mx-auto rounded-xl object-contain border border-slate-800 shadow-md" alt="Preview of weight scale" />
                    <span className="text-[10px] text-slate-500 font-bold block">TAP TO UPLOAD DIFFERENT SCREENSHOT</span>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-slate-900 text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-950/40 rounded-full border border-slate-800 transition">
                      <Camera size={26} />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-white">Upload Weight Scale Photo *</h5>
                      <p className="text-[10px] text-slate-500 mt-0.5">Capture scale readout screenshot. Required before slip generation.</p>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-slate-800 pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Optional Procurement Logistics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-300 mb-1">Transport Cost (₹)</label>
                    <input type="number" value={transportCost} onChange={e => setTransportCost(e.target.value)} placeholder="e.g. 1500" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none" />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Labour Wages (₹)</label>
                    <input type="number" value={labourCost} onChange={e => setLabourCost(e.target.value)} placeholder="e.g. 1000" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl lg:col-span-1 flex flex-col justify-between space-y-6 shadow-lg">
              <div>
                <h3 className="font-display font-extrabold text-base text-slate-300 border-b border-slate-800 pb-2 mb-4 uppercase tracking-wider">Expected Payout</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Weighing:</span>
                    <span className="font-bold text-white">{(parseFloat(quintals) || 0).toFixed(2)} Qtl</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Deducted Amount:</span>
                    <span className="font-bold text-red-400">-₹{(parseFloat(deductions || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-slate-300">
                    <span className="font-semibold">Net Quantity Weighed:</span>
                    <span className="font-bold text-white">{(parseFloat(quintals) || 0).toFixed(2)} Qtl</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-emerald-400">
                    <span className="font-bold">Total Expected Pay:</span>
                    <span className="font-display font-extrabold text-base">₹{calculatedPayout.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition cursor-pointer text-xs uppercase tracking-wide disabled:opacity-50 outline-none"
                disabled={!weightImage}
              >
                {translate('processProcurement')}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[60vh]">
            <div className="glass-panel bg-slate-900/40 border border-slate-800 p-4 rounded-2xl lg:col-span-1 space-y-2 overflow-y-auto shadow-lg">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Helpline Contacts</span>
                {totalAdminUnreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-extrabold animate-bounce">
                    {totalAdminUnreadCount} {translate('unread') || 'unread'}
                  </span>
                )}
              </h3>
              {chatUsers.map((cu) => (
                <button
                  key={cu.id}
                  onClick={() => {
                    setActivePeerId(cu.id);
                    triggerToastGlobal('Helpline Activated 💬', `Chat with ${cu.name}`);
                    setTotalAdminUnreadCount(prev => Math.max(0, prev - (cu.unread_count || 0)));
                    setChatUsers(prev => prev.map(u => u.id === cu.id ? { ...u, unread_count: 0 } : u));
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition text-xs flex flex-col gap-0.5 cursor-pointer ${activePeerId === cu.id
                      ? 'helpline-contact-btn-active font-bold shadow-sm'
                      : 'helpline-contact-btn-inactive bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-transparent text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                    }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className={`font-bold ${activePeerId === cu.id ? 'helpline-contact-text-active' : 'text-slate-800 dark:text-white'}`}>{cu.name}</span>
                    {cu.unread_count > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full animate-bounce">
                        {cu.unread_count}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${activePeerId === cu.id ? 'helpline-contact-subtext-active' : 'text-slate-500'}`}>{translate(cu.role)} {cu.village ? `| ${cu.village}` : ''}</span>
                </button>
              ))}
            </div>

            <div className="glass-panel bg-slate-900/40 border border-slate-800 p-4 rounded-2xl lg:col-span-2 flex flex-col justify-between h-full shadow-lg">
              {activePeerId ? (
                <>
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                        Chat Session with {chatUsers.find(u => u.id === activePeerId)?.name || 'User'}
                      </h4>
                    </div>
                    {messages.length > 0 && (
                      <button
                        onClick={() => handleClearConversationAdmin(activePeerId)}
                        className="text-[10px] bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-bold px-2 py-1 rounded-lg transition cursor-pointer select-none flex items-center gap-1"
                      >
                        <Trash2 size={10} />
                        Clear Chat
                      </button>
                    )}
                  </div>
                  <div className="flex-grow overflow-y-auto space-y-3 p-2">
                    {messages.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-12">No helpline message records. Say hello!</p>
                    ) : (
                      messages.map((msg, idx) => {
                        const isMe = msg.sender_id === user.id;
                        return (
                          <div key={idx} className={`flex items-center gap-1.5 group ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {isMe && msg.id && (
                              <button
                                onClick={() => handleDeleteMessageAdmin(msg.id)}
                                className="opacity-25 hover:opacity-100 sm:opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition cursor-pointer select-none self-center"
                                title="Delete message"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                            <div className={`p-3 rounded-2xl max-w-xs text-xs leading-relaxed ${isMe
                                ? 'helpline-bubble-me rounded-br-none shadow-sm'
                                : 'helpline-bubble-peer rounded-bl-none shadow-sm'
                              }`}>
                              {!isMe && <span className="block font-bold text-[9px] text-emerald-700 dark:text-emerald-400 uppercase mb-1">{msg.sender_name}</span>}
                              <p>{msg.message}</p>
                              <span className={`block text-[8px] text-right mt-1.5 ${isMe ? 'text-emerald-800/80 dark:text-rose-200' : 'text-slate-500 dark:text-slate-400'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {!isMe && msg.id && (
                              <button
                                onClick={() => handleDeleteMessageAdmin(msg.id)}
                                className="opacity-25 hover:opacity-100 sm:opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition cursor-pointer select-none self-center"
                                title="Delete message"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-2">
                    <input
                      type="text"
                      value={typedMessage}
                      onChange={e => setTypedMessage(e.target.value)}
                      placeholder="Type a message to helpline..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500"
                    />
                    <button type="submit" className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition cursor-pointer">
                      <Send size={14} />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
                  <MessageSquare className="text-slate-400 dark:text-slate-600 animate-pulse" size={32} />
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Select a Helpline Chat session</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">Select any field worker, employee, or farmer from the contact list to start an in-app messaging log.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'recovery' && (
          <div className="glass-panel p-6 rounded-2xl space-y-4 animate-slide-up shadow-lg">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-display font-extrabold text-lg text-white">Password Recovery Requests</h3>
                <p className="text-xs text-slate-400 mt-0.5">Approve or reject requests submitted by users who forgot their password/PIN credentials.</p>
              </div>
            </div>

            {recoveryRequests.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12">No password recovery requests submitted.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3">User Details</th>
                      <th className="p-3">Verification Info</th>
                      <th className="p-3">Desired Credentials</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300">
                    {recoveryRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-900/20">
                        <td className="p-3">
                          <h4 className="font-bold text-white text-sm">{req.name}</h4>
                          <p className="text-slate-400 font-mono mt-0.5">{req.phone}</p>
                        </td>
                        <td className="p-3">
                          <p><strong className="text-slate-500">Village:</strong> {req.village}</p>
                          <p className="mt-0.5"><strong className="text-slate-500">Last remembered keys:</strong> Pass: "{req.last_password}", PIN: "{req.last_pin}"</p>
                        </td>
                        <td className="p-3">
                          <p><strong className="text-slate-500">New Pass:</strong> "{req.new_password}"</p>
                          <p className="mt-0.5"><strong className="text-slate-500">New PIN:</strong> "{req.new_pin}"</p>
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${req.status === 'pending'
                              ? 'bg-amber-950/40 text-amber-400 border-amber-900/50'
                              : req.status === 'approved'
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
                                : 'bg-red-950/40 text-red-400 border-red-900/50'
                            }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {req.status === 'pending' ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleResolveRecovery(req.id, 'approve')}
                                className="bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-900/50 font-bold px-3 py-1.5 rounded-lg transition cursor-pointer text-[10px] uppercase tracking-wider"
                              >
                                Approve & Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResolveRecovery(req.id, 'reject')}
                                className="bg-red-950 text-red-400 hover:bg-red-900 border border-red-900/50 font-bold px-3 py-1.5 rounded-lg transition cursor-pointer text-[10px] uppercase tracking-wider"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end items-center gap-3">
                              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">Resolved</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteRecovery(req.id)}
                                className="bg-red-950/20 text-red-400 hover:bg-red-900 border border-red-900/30 hover:border-red-900/50 font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer text-[9px] uppercase tracking-wider flex items-center gap-1"
                              >
                                <Trash2 size={12} />
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && <ProfileEditor token={token} setToken={setToken} user={user} onUserUpdate={onUserUpdate} />}
      </div>

      {/* Premium Payslip receipt Info Modal */}
      {selectedReceiptForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 text-xs p-6 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setSelectedReceiptForModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg cursor-pointer transition"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
              <div className="p-2.5 bg-emerald-950 text-emerald-400 border border-emerald-900/50 rounded-xl">
                <FileText size={20} />
              </div>
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">FarmEase Digital Payslip</span>
                <h4 className="font-display font-extrabold text-sm text-white mt-0.5">{selectedReceiptForModal.receipt_no}</h4>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">FARMER NAME</span>
                  <p className="font-bold text-slate-200 mt-0.5">{selectedReceiptForModal.farmer_name}</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">VILLAGE</span>
                  <p className="font-semibold text-slate-300 mt-0.5">{selectedReceiptForModal.farmer_village}</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">PHONE</span>
                  <p className="font-mono text-slate-300 mt-0.5">{selectedReceiptForModal.farmer_phone}</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">SLIP ID</span>
                  <p className="font-bold text-emerald-400 font-mono mt-0.5">{selectedReceiptForModal.slip_id}</p>
                </div>
              </div>

              <div className="border-t border-b border-slate-800 py-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Crop Name:</span>
                  <span className="font-bold text-white">{selectedReceiptForModal.crop_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Net Quantity:</span>
                  <span className="font-bold text-slate-200">{selectedReceiptForModal.quintals?.toFixed(2)} Quintals</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Payment Mode:</span>
                  <span className="font-bold text-emerald-400 uppercase">{selectedReceiptForModal.payment_mode}</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-4 rounded-xl space-y-2 border border-slate-850">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold uppercase text-[9px]">
                    {(selectedReceiptForModal.receipt_type || '') === 'settlement' ? 'Settlement Amount:' : 'Amount Paid:'}
                  </span>
                  <span className="font-bold text-emerald-400 text-sm">{formatCurrency(selectedReceiptForModal.amount_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold uppercase text-[9px]">Total Procurement:</span>
                  <span className="font-semibold text-slate-400">{formatCurrency(selectedReceiptForModal.total_amount)}</span>
                </div>
                {selectedReceiptForModal.paymentSummary?.breakdown?.byMode?.length > 0 && (
                  <div className="pt-1.5 border-t border-slate-900">
                    <span className="text-slate-500 font-semibold uppercase text-[9px] block mb-1.5">All Payments By Mode:</span>
                    {selectedReceiptForModal.paymentSummary.breakdown.byMode.map((row) => (
                      <div key={`${selectedReceiptForModal.procurement_id}-${row.payment_mode}`} className="flex justify-between text-[11px] py-0.5">
                        <span className="text-slate-400 uppercase">{row.payment_mode}</span>
                        <span className="font-semibold text-emerald-300">{formatCurrency(row.total)} <span className="text-slate-500">({row.count})</span></span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[11px] py-0.5 border-t border-slate-900 mt-1">
                      <span className="text-slate-400 uppercase">Total paid all types</span>
                      <span className="font-bold text-emerald-300">{formatCurrency(selectedReceiptForModal.paymentSummary.paid_amount)}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-slate-900">
                  <span className="text-slate-500 font-semibold uppercase text-[9px]">Remaining Due:</span>
                  <span className={`font-bold ${Number(selectedReceiptForModal.due_after) > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{formatCurrency(selectedReceiptForModal.due_after)}</span>
                </div>
              </div>

              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Issued: {new Date(selectedReceiptForModal.created_at).toLocaleString()}</span>
                <span>By: {selectedReceiptForModal.issued_by_name || 'FarmEase Mandi Staff'}</span>
              </div>
            </div>

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => downloadPaymentReceiptPDF(selectedReceiptForModal)}
                className="flex-grow bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl cursor-pointer transition select-none flex items-center justify-center gap-1.5"
              >
                <Download size={14} />
                Download PDF Receipt
              </button>
              <button
                onClick={() => setSelectedReceiptForModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl cursor-pointer transition select-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
