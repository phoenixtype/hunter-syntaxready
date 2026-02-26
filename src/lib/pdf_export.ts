import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, WidthType, SectionType, convertInchesToTwip } from "docx";
import { CandidateProfile } from "./resume_engine";

// ─── PDF (jsPDF text-based, fully ATS-parseable) ──────────────────────────────

export const exportResumeToPdf = (profile: CandidateProfile, filename?: string, options?: { onePage?: boolean }) => {
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

    const sectionRule = (title: string) => {
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
    doc.setTextColor(80, 80, 80);
    const contactParts = [
        identity.email,
        identity.phone,
        ...(identity.links || []).map(l =>
            l.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]
        ),
    ].filter(Boolean);
    doc.text(contactParts.join("   |   "), M, y);
    y += LH * 1.2;

    // ── Summary ──
    if (summary) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(BODY);
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(summary, CW);
        doc.text(lines, M, y);
        y += lines.length * LH + 4;
    }

    // ── Skills ──
    if (skills.length > 0) {
        sectionRule("Skills");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(BODY);
        doc.setTextColor(40, 40, 40);
        const txt = skills
            .slice()
            .sort((a, b) => b.proficiency - a.proficiency)
            .map(s => s.name)
            .join("  •  ");
        const skillLines = doc.splitTextToSize(txt, CW);
        doc.text(skillLines, M, y);
        y += skillLines.length * LH;
    }

    // ── Experience ──
    if (experience_atoms.length > 0) {
        sectionRule("Professional Experience");
        for (const exp of experience_atoms) {
            checkPage(LH * 5);

            // Role title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(BODY);
            doc.setTextColor(15, 15, 15);
            doc.text(exp.role || "", M, y);

            // Duration — right-aligned on same baseline
            if (exp.duration) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(SMALL);
                doc.setTextColor(80, 80, 80);
                doc.text(exp.duration, M + CW, y, { align: "right" });
            }
            y += LH - 1;

            // Company
            doc.setFont("helvetica", "italic");
            doc.setFontSize(SMALL);
            doc.setTextColor(60, 60, 60);
            doc.text(exp.company || "", M, y);
            y += LH;

            // Content bullets
            if (exp.content) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(BODY);
                doc.setTextColor(40, 40, 40);
                const bulletLines = exp.content.split("\n").map(l => l.trim()).filter(Boolean);
                for (const line of bulletLines) {
                    const bullet = line.startsWith("•") ? line : `• ${line}`;
                    const wrapped = doc.splitTextToSize(bullet, CW - 14);
                    checkPage(wrapped.length * LH + 2);
                    doc.text(wrapped, M + 10, y, { lineHeightFactor: 1.3 });
                    y += wrapped.length * LH;
                }
            }
            y += 6;
        }
    }

    // ── Education ──
    if (education.length > 0) {
        sectionRule("Education");
        for (const edu of education) {
            checkPage(LH * 3);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(BODY);
            doc.setTextColor(15, 15, 15);
            const degreeDisplay = [edu.degree, edu.field].filter(Boolean).join(" — ");
            doc.text(degreeDisplay || "", M, y);
            y += LH - 1;
            doc.setFont("helvetica", "italic");
            doc.setFontSize(SMALL);
            doc.setTextColor(60, 60, 60);
            doc.text(
                [edu.school, edu.year].filter(Boolean).join("  ·  "),
                M,
                y
            );
            y += LH + 4;
        }
    }

    // Trim to 1 page if requested
    if (onePage) {
        const totalPages = (doc.internal as any).getNumberOfPages?.() ?? (doc as any).getNumberOfPages?.() ?? 1;
        for (let p = totalPages; p > 1; p--) {
            doc.deletePage(p);
        }
    }

    doc.save(filename || `${(identity.name || "resume").replace(/\s+/g, "_")}_resume.pdf`);
};


// ─── DOCX (docx package, opens in Word/Google Docs) ──────────────────────────

export const exportResumeToDocx = async (profile: CandidateProfile, filename?: string) => {
    const { identity, skills, experience_atoms, education, summary } = profile;

    const hr = () =>
        new Paragraph({
            border: { bottom: { color: "888888", size: 6, space: 4, style: BorderStyle.SINGLE } },
            spacing: { before: 160, after: 80 },
        });

    const sectionHeading = (text: string) =>
        new Paragraph({
            children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: "111111" })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 60 },
            border: { bottom: { color: "888888", size: 6, space: 4, style: BorderStyle.SINGLE } },
        });

    const body = (text: string, opts?: { bold?: boolean; italic?: boolean; size?: number; color?: string }) =>
        new Paragraph({
            children: [
                new TextRun({
                    text,
                    bold: opts?.bold,
                    italics: opts?.italic,
                    size: opts?.size ?? 20,
                    color: opts?.color ?? "333333",
                }),
            ],
            spacing: { after: 40 },
        });

    const bullet = (text: string) =>
        new Paragraph({
            children: [new TextRun({ text, size: 20, color: "333333" })],
            bullet: { level: 0 },
            spacing: { after: 40 },
        });

    const sections: Paragraph[] = [];

    // ── Name ──
    sections.push(
        new Paragraph({
            children: [new TextRun({ text: identity.name || "Your Name", bold: true, size: 40, color: "111111" })],
            spacing: { after: 60 },
        })
    );

    // ── Contact ──
    const contactParts = [
        identity.email,
        identity.phone,
        ...(identity.links || []),
    ].filter(Boolean);
    sections.push(
        new Paragraph({
            children: contactParts.flatMap((p, i) => [
                new TextRun({ text: p!, size: 18, color: "555555" }),
                ...(i < contactParts.length - 1 ? [new TextRun({ text: "   |   ", size: 18, color: "999999" })] : []),
            ]),
            spacing: { after: 120 },
        })
    );

    // ── Summary ──
    if (summary) {
        sections.push(body(summary, { size: 20, color: "333333" }));
        sections.push(new Paragraph({ spacing: { after: 80 } }));
    }

    // ── Skills ──
    if (skills.length > 0) {
        sections.push(sectionHeading("Skills"));
        const skillsText = skills
            .slice()
            .sort((a, b) => b.proficiency - a.proficiency)
            .map(s => s.name)
            .join("  •  ");
        sections.push(body(skillsText));
    }

    // ── Experience ──
    if (experience_atoms.length > 0) {
        sections.push(sectionHeading("Professional Experience"));
        for (const exp of experience_atoms) {
            sections.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: exp.role || "", bold: true, size: 22, color: "111111" }),
                        ...(exp.duration
                            ? [new TextRun({ text: `   ${exp.duration}`, size: 18, color: "777777" })]
                            : []),
                    ],
                    spacing: { after: 30 },
                })
            );
            if (exp.company) {
                sections.push(body(exp.company, { italic: true, size: 18, color: "555555" }));
            }
            if (exp.content) {
                const lines = exp.content.split("\n").map(l => l.trim()).filter(Boolean);
                for (const line of lines) {
                    sections.push(bullet(line.startsWith("•") ? line.slice(1).trim() : line));
                }
            }
            sections.push(new Paragraph({ spacing: { after: 80 } }));
        }
    }

    // ── Education ──
    if (education.length > 0) {
        sections.push(sectionHeading("Education"));
        for (const edu of education) {
            sections.push(body([edu.degree, edu.field].filter(Boolean).join(" — ") || "", { bold: true }));
            sections.push(
                body([edu.school, edu.year].filter(Boolean).join("  ·  "), { italic: true, size: 18, color: "555555" })
            );
            sections.push(new Paragraph({ spacing: { after: 60 } }));
        }
    }

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: convertInchesToTwip(0.75),
                            bottom: convertInchesToTwip(0.75),
                            left: convertInchesToTwip(0.85),
                            right: convertInchesToTwip(0.85),
                        },
                    },
                },
                children: sections,
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `${(identity.name || "resume").replace(/\s+/g, "_")}_resume.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
