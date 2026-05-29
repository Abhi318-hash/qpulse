import jsPDF from 'jspdf';

export interface PrescriptionData {
  clinicName: string;
  doctorName: string;
  specialization: string;
  clinicAddress: string;
  clinicPhone: string;
  
  patientName: string;
  patientAge: string | number;
  patientPhone: string;
  patientGender?: string;
  patientBloodGroup?: string;
  
  date: string;
  chiefComplaint: string;
  diagnosis: string;
  
  vitals: {
    bpSystolic?: number;
    bpDiastolic?: number;
    heartRate?: number;
    temperature?: number;
    weightKg?: number;
    spo2?: number;
  };
  
  medications: Array<{
    name: string;
    dosage: string;
    duration: string;
    instructions: string;
  }>;
  
  testsOrdered: string[];
  followUpDate: string;
  doctorNotes: string;
}

export function generatePrescriptionPDF(data: PrescriptionData): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;
  
  // Header: Clinic Info
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 123, 255); // Primary Blue
  doc.text(data.clinicName || 'Clinic Prescription', pageWidth / 2, y, { align: 'center' });
  
  y += 7;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text(`Dr. ${data.doctorName} | ${data.specialization}`, pageWidth / 2, y, { align: 'center' });
  
  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  if (data.clinicAddress) doc.text(data.clinicAddress, pageWidth / 2, y, { align: 'center' });
  if (data.clinicPhone) {
    y += 5;
    doc.text(`Phone: ${data.clinicPhone}`, pageWidth / 2, y, { align: 'center' });
  }
  
  // Divider line
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(15, y, pageWidth - 15, y);
  
  // Patient Info & Date
  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Patient Name:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.patientName}`, 45, y);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', pageWidth - 60, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.date}`, pageWidth - 45, y);
  
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Age / Gender:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.patientAge || 'N/A'} / ${data.patientGender || 'N/A'}`, 45, y);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Phone:', pageWidth - 60, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.patientPhone || 'N/A'}`, pageWidth - 45, y);

  if (data.patientBloodGroup) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Blood Group:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.patientBloodGroup}`, 45, y);
  }
  
  y += 10;
  doc.line(15, y, pageWidth - 15, y);
  
  // Vitals
  const vitalsText = [];
  if (data.vitals.bpSystolic) vitalsText.push(`BP: ${data.vitals.bpSystolic}/${data.vitals.bpDiastolic || '-'} mmHg`);
  if (data.vitals.heartRate) vitalsText.push(`HR: ${data.vitals.heartRate} bpm`);
  if (data.vitals.temperature) vitalsText.push(`Temp: ${data.vitals.temperature}°C`);
  if (data.vitals.weightKg) vitalsText.push(`Weight: ${data.vitals.weightKg} kg`);
  if (data.vitals.spo2) vitalsText.push(`SpO2: ${data.vitals.spo2}%`);
  
  if (vitalsText.length > 0) {
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80, 80, 80);
    doc.text(`Vitals: ${vitalsText.join('  |  ')}`, 15, y);
    y += 4;
  }
  
  y += 8;
  // Rx Symbol
  doc.setFontSize(24);
  doc.setFont('times', 'bolditalic');
  doc.setTextColor(0, 0, 0);
  doc.text('Rx', 15, y);
  
  y += 10;
  
  // Diagnosis & Complaints
  if (data.chiefComplaint || data.diagnosis) {
    doc.setFontSize(11);
    if (data.chiefComplaint) {
      doc.setFont('helvetica', 'bold');
      doc.text('C/O:', 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.chiefComplaint, 25, y);
      y += 6;
    }
    if (data.diagnosis) {
      doc.setFont('helvetica', 'bold');
      doc.text('Diagnosis:', 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(data.diagnosis, 38, y);
      y += 8;
    }
  }
  
  // Medications List
  if (data.medications && data.medications.length > 0) {
    y += 4;
    data.medications.forEach((med, index) => {
      // Check page break
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${med.name}`, 15, y);
      y += 5;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`Dosage: ${med.dosage}  |  Duration: ${med.duration}`, 25, y);
      
      if (med.instructions) {
        y += 5;
        doc.text(`Inst: ${med.instructions}`, 25, y);
      }
      y += 8;
      doc.setTextColor(0, 0, 0);
    });
  }
  
  // Tests
  if (data.testsOrdered && data.testsOrdered.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 4;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Investigations / Tests Ordered:', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(data.testsOrdered.join(', '), 15, y, { maxWidth: pageWidth - 30 });
    // Approx height
    y += Math.ceil(data.testsOrdered.join(', ').length / 100) * 5 + 4;
  }
  
  // Advice / Notes
  if (data.doctorNotes) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 4;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Advice / Notes:', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    
    const lines = doc.splitTextToSize(data.doctorNotes, pageWidth - 30);
    doc.text(lines, 15, y);
    y += (lines.length * 5) + 4;
  }
  
  // Follow Up
  if (data.followUpDate) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Follow Up:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.followUpDate, 38, y);
  }
  
  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated by Q-Pulse Digital Clinic', pageWidth / 2, 285, { align: 'center' });
  
  // Return as Blob
  return doc.output('blob');
}
