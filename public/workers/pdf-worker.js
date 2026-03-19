/**
 * PDF Generation Web Worker
 *
 * Handles heavy PDF and DOCX generation operations off the main thread
 * to prevent blocking the UI (eliminates 500ms-2s blocking time).
 */

// Import jsPDF and docx libraries
importScripts('https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js');
importScripts('https://unpkg.com/docx@8.2.2/build/index.js');

self.onmessage = async function(e) {
    const { type, profile, filename, options } = e.data;

    try {
        switch (type) {
            case 'generatePDF':
                const pdfResult = await generatePDF(profile, filename, options);
                self.postMessage({ success: true, data: pdfResult, type: 'pdf' });
                break;

            case 'generateDOCX':
                const docxResult = await generateDOCX(profile, filename);
                self.postMessage({ success: true, data: docxResult, type: 'docx' });
                break;

            default:
                throw new Error(`Unknown operation type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            success: false,
            error: error.message,
            type: type
        });
    }
};

async function generatePDF(profile, filename, options = {}) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const onePage = options?.onePage ?? false;
    const M = onePage ? 42 : 54;
    const CW = PW - 2 * M;
    let y = M;

    const LH = onePage ? 12 : 13.5;
    const SMALL = onePage ? 8.5 : 9.5;
    const BODY = onePage ? 9.5 : 10.5;
    const H2 = onePage ? 10 : 11;

    const checkPage = (needed = LH * 3) => {
        if (y + needed > PH - M) {
            doc.addPage();
            y = M;
        }
    };

    const sectionRule = (title) => {
        checkPage(LH * 4);
        y += 10;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(H2);
        doc.setTextColor(20, 20, 20);
        doc.text(title.toUpperCase(), M, y);
        y += 3;
        doc.setDrawColor(100, 100, 100);
        doc.line(M, y, M + CW, y);
        y += LH;
    };

    const { identity, skills, experience_atoms, education, summary } = profile;

    // ── Name ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 15, 15);
    doc.text(identity.name || "Your Name", M, y);
    y += 22;

    // ── Contact line ──
    doc.setFont("helvetica", "normal");
    doc.setFontSize(SMALL);
    doc.setTextColor(60, 60, 60);
    const contactParts = [
        identity.email,
        identity.phone,
        identity.location,
        ...(identity.links || [])
    ].filter(Boolean);
    if (contactParts.length > 0) {
        doc.text(contactParts.join("  •  "), M, y);
        y += LH + 6;
    }

    // ── Summary ──
    if (summary) {
        sectionRule("Professional Summary");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(BODY);
        doc.setTextColor(30, 30, 30);
        const summaryLines = doc.splitTextToSize(summary, CW);
        doc.text(summaryLines, M, y);
        y += summaryLines.length * LH + 6;
    }

    // ── Skills ──
    if (skills && skills.length > 0) {
        sectionRule("Technical Skills");
        const skillsText = skills.map(s => s.name).join(", ");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(BODY);
        doc.setTextColor(30, 30, 30);
        const skillLines = doc.splitTextToSize(skillsText, CW);
        doc.text(skillLines, M, y);
        y += skillLines.length * LH + 6;
    }

    // ── Experience ──
    if (experience_atoms && experience_atoms.length > 0) {
        sectionRule("Professional Experience");
        experience_atoms.forEach(exp => {
            checkPage(LH * 4);

            // Job title and company
            doc.setFont("helvetica", "bold");
            doc.setFontSize(BODY);
            doc.setTextColor(20, 20, 20);
            doc.text(`${exp.role} - ${exp.company}`, M, y);
            y += LH;

            // Duration
            doc.setFont("helvetica", "normal");
            doc.setFontSize(SMALL);
            doc.setTextColor(80, 80, 80);
            doc.text(exp.duration, M, y);
            y += LH + 3;

            // Content
            doc.setFont("helvetica", "normal");
            doc.setFontSize(BODY);
            doc.setTextColor(30, 30, 30);
            const contentLines = doc.splitTextToSize(exp.content, CW);
            doc.text(contentLines, M, y);
            y += contentLines.length * LH + 8;
        });
    }

    // ── Education ──
    if (education && education.length > 0) {
        sectionRule("Education");
        education.forEach(edu => {
            checkPage(LH * 2);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(BODY);
            doc.setTextColor(20, 20, 20);
            doc.text([edu.degree, edu.field].filter(Boolean).join(" in "), M, y);
            y += LH;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(SMALL);
            doc.setTextColor(60, 60, 60);
            doc.text([edu.school, edu.year].filter(Boolean).join("  •  "), M, y);
            y += LH + 4;
        });
    }

    // Trim to 1 page if requested
    if (onePage) {
        const totalPages = doc.internal.getNumberOfPages?.() ?? doc.getNumberOfPages?.() ?? 1;
        for (let p = totalPages; p > 1; p--) {
            doc.deletePage(p);
        }
    }

    // Generate blob for download
    const pdfBlob = doc.output('blob');
    const finalFilename = filename || `${(identity.name || "resume").replace(/\s+/g, "_")}_resume.pdf`;

    return {
        blob: pdfBlob,
        filename: finalFilename,
        size: pdfBlob.size
    };
}

async function generateDOCX(profile, filename) {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = window.docx;
    const { identity, skills, experience_atoms, education, summary } = profile;

    const sectionHeading = (text) =>
        new Paragraph({
            children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: "111111" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 60 },
            border: { bottom: { color: "888888", size: 6, space: 4, style: BorderStyle.SINGLE } },
        });

    const sections = [];

    // Header
    sections.push(
        new Paragraph({
            children: [new TextRun({ text: identity.name || "Your Name", bold: true, size: 28, color: "0f0f0f" })],
            spacing: { after: 120 }
        })
    );

    // Contact
    const contactParts = [identity.email, identity.phone, identity.location, ...(identity.links || [])].filter(Boolean);
    if (contactParts.length > 0) {
        sections.push(
            new Paragraph({
                children: [new TextRun({ text: contactParts.join("  •  "), size: 20, color: "3c3c3c" })],
                spacing: { after: 180 }
            })
        );
    }

    // Summary
    if (summary) {
        sections.push(sectionHeading("Professional Summary"));
        sections.push(new Paragraph({ children: [new TextRun({ text: summary, size: 22 })], spacing: { after: 120 } }));
    }

    // Skills
    if (skills && skills.length > 0) {
        sections.push(sectionHeading("Technical Skills"));
        sections.push(new Paragraph({
            children: [new TextRun({ text: skills.map(s => s.name).join(", "), size: 22 })],
            spacing: { after: 120 }
        }));
    }

    // Experience
    if (experience_atoms && experience_atoms.length > 0) {
        sections.push(sectionHeading("Professional Experience"));
        experience_atoms.forEach(exp => {
            sections.push(
                new Paragraph({
                    children: [new TextRun({ text: `${exp.role} - ${exp.company}`, bold: true, size: 22 })],
                    spacing: { before: 60, after: 30 }
                })
            );
            sections.push(
                new Paragraph({
                    children: [new TextRun({ text: exp.duration, size: 20, italics: true, color: "505050" })],
                    spacing: { after: 60 }
                })
            );
            sections.push(
                new Paragraph({
                    children: [new TextRun({ text: exp.content, size: 22 })],
                    spacing: { after: 120 }
                })
            );
        });
    }

    // Education
    if (education && education.length > 0) {
        sections.push(sectionHeading("Education"));
        education.forEach(edu => {
            sections.push(
                new Paragraph({
                    children: [new TextRun({ text: [edu.degree, edu.field].filter(Boolean).join(" in "), bold: true, size: 22 })],
                    spacing: { before: 60, after: 30 }
                })
            );
            sections.push(
                new Paragraph({
                    children: [new TextRun({ text: [edu.school, edu.year].filter(Boolean).join("  •  "), size: 20, color: "3c3c3c" })],
                    spacing: { after: 60 }
                })
            );
        });
    }

    const doc = new Document({ sections: [{ children: sections }] });
    const docBlob = await Packer.toBlob(doc);
    const finalFilename = filename || `${(identity.name || "resume").replace(/\s+/g, "_")}_resume.docx`;

    return {
        blob: docBlob,
        filename: finalFilename,
        size: docBlob.size
    };
}