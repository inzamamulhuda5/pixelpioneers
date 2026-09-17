import jsPDF from 'jspdf';
import { Appointment } from '../types';

export function downloadAppointmentReceipt(appointment: Appointment): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Background tint
  doc.setFillColor(250, 250, 250);
  doc.rect(0, 0, 210, 297, 'F');

  // Header Banner
  doc.setFillColor(13, 148, 136); // Teal 600
  doc.rect(0, 0, 210, 32, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PIXEL PIONEERS', 16, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('AI Patient Intake & Clinic Coordination Network', 16, 25);

  // Watermark/Badge
  doc.setFillColor(20, 184, 166);
  doc.roundedRect(148, 10, 48, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('OFFICIAL RECEIPT', 154, 18);

  // Card container
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(15, 42, 180, 205, 3, 3, 'FD');

  // Receipt Title & ID
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Appointment Confirmation & Receipt', 22, 54);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(`Booking Reference ID: ${appointment.id}`, 22, 62);
  doc.text(`Issued On: ${new Date(appointment.createdAt).toLocaleString()}`, 130, 62);

  // Divider line
  doc.setDrawColor(243, 244, 246);
  doc.line(22, 67, 188, 67);

  // Section 1: Patient Information
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Patient Details', 22, 76);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text(`Full Name: ${appointment.patientName}`, 22, 83);
  doc.text(`Contact Phone: ${appointment.patientPhone}`, 22, 89);
  doc.text(`Email Address: ${appointment.patientEmail}`, 22, 95);
  if (appointment.chiefConcern) {
    doc.text(`Reported Concern: ${appointment.chiefConcern}`, 22, 101);
  }

  // Section 2: Clinical Details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Consultation & Clinic Details', 22, 114);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text(`Consulting Doctor: ${appointment.doctor.name}`, 22, 121);
  doc.text(`Specialty: ${appointment.specialty} (${appointment.doctor.qualification})`, 22, 127);
  doc.text(`Clinic: ${appointment.clinic.name}`, 22, 133);
  doc.text(`Address: ${appointment.clinic.address}`, 22, 139);
  doc.text(`City & Area: ${appointment.clinic.area}, ${appointment.clinic.city}`, 22, 145);

  // Highlight Box: Scheduled Time
  doc.setFillColor(240, 253, 250); // Teal 50
  doc.setDrawColor(204, 251, 241);
  doc.roundedRect(22, 152, 166, 18, 2, 2, 'FD');

  doc.setTextColor(15, 118, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Scheduled Date & Time:  ${appointment.date}  at  ${appointment.time}`, 28, 163);

  // Section 3: Transparent Pricing Breakdown
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Fee Breakdown', 22, 182);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);

  doc.text('Doctor Consultation Base Fee', 22, 190);
  doc.text(`INR ${appointment.pricing.baseFee}.00`, 160, 190, { align: 'right' });

  doc.text(appointment.pricing.triageAdjustmentLabel, 22, 196);
  doc.text(`INR ${appointment.pricing.triageAdjustment}.00`, 160, 196, { align: 'right' });

  doc.text('Clinic Administrative Service Fee', 22, 202);
  doc.text(`INR ${appointment.pricing.hospitalServiceFee}.00`, 160, 202, { align: 'right' });

  doc.setDrawColor(229, 231, 235);
  doc.line(22, 206, 188, 206);

  // Total
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Total Amount Payable / Verified', 22, 214);
  doc.setTextColor(13, 148, 136);
  doc.text(`INR ${appointment.pricing.total}.00`, 160, 214, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(107, 114, 128);
  doc.text('Payment Status: Confirmed & Reserved at Clinic Desk', 22, 221);

  // Medical Safety & Prototype Disclaimer Notice
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text(
    'IMPORTANT MEDICAL NOTICE: Pixel Pioneers is an AI-powered patient intake and scheduling assistant, not a licensed medical practitioner.',
    15,
    256
  );
  doc.text(
    'This receipt confirms appointment scheduling. For medical emergencies (severe chest pain, breathing difficulty, sudden trauma), call 102/112 immediately.',
    15,
    261
  );
  doc.text(
    'DEMO DATA PROTOTYPE: Generated for evaluation purposes. Clinic names, doctor credentials, and bookings are realistic fictional data.',
    15,
    266
  );

  // Save the PDF
  doc.save(`PixelPioneers_Receipt_${appointment.id}.pdf`);
}

// Generates an .ics calendar invitation
export function downloadCalendarInvite(appointment: Appointment): void {
  const dateParts = appointment.date.split('-');
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pixel Pioneers//Medical Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:px-${appointment.id}@pixelpioneers.health`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${year}${month}${day}T090000Z`,
    `DTEND:${year}${month}${day}T100000Z`,
    `SUMMARY:Medical Appointment with ${appointment.doctor.name} (${appointment.specialty})`,
    `DESCRIPTION:Pixel Pioneers Appointment Reference: ${appointment.id}\\nClinic: ${appointment.clinic.name}\\nAddress: ${appointment.clinic.address}\\nPatient: ${appointment.patientName}`,
    `LOCATION:${appointment.clinic.address}, ${appointment.clinic.city}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Appointment_${appointment.id}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
