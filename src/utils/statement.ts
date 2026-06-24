import { jsPDF } from "jspdf";
import { unitLabel, type Customer, type Transaction } from "../db";

interface StatementData {
  customer: Customer;
  transactions: Transaction[];
  businessName?: string;
  businessSubline?: string;
  businessPhone?: string;
}

function inr(n: number): string {
  return "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateStatementPDF(data: StatementData): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 20;

  const business = data.businessName || "Hazra Workshop";
  const subline = data.businessSubline || "Steel Grill, Gate, Railing & Fabrication - Kolkata, West Bengal";
  const phone = data.businessPhone || "";

  // Header band
  doc.setFillColor(26, 115, 232);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(business, margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subline, margin, 20);
  if (phone) {
    doc.text(`Phone: ${phone}`, margin, 25);
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("LEDGER STATEMENT", pageW - margin, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, pageW - margin, 20, { align: "right" });

  y = 38;

  // Customer block
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CUSTOMER", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(data.customer.name, margin, y + 6);
  if (data.customer.phone) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Phone: ${data.customer.phone}`, margin, y + 11);
  }
  y += 18;

  // Summary box
  const gaveTotal = data.transactions
    .filter((t) => t.type === "gave")
    .reduce((s, t) => s + t.amount, 0);
  const gotTotal = data.transactions
    .filter((t) => t.type === "got")
    .reduce((s, t) => s + t.amount, 0);
  const net = gaveTotal - gotTotal;

  doc.setDrawColor(26, 115, 232);
  doc.setFillColor(240, 244, 252);
  doc.roundedRect(margin, y, pageW - margin * 2, 22, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(26, 115, 232);
  doc.text("TOTAL DEBIT (GAVE)", margin + 4, y + 6);
  doc.text("TOTAL CREDIT (GOT)", margin + (pageW - margin * 2) / 2 + 2, y + 6);
  doc.text("NET BALANCE", pageW - margin - 4, y + 6, { align: "right" });

  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(inr(gaveTotal), margin + 4, y + 13);
  doc.text(inr(gotTotal), margin + (pageW - margin * 2) / 2 + 2, y + 13);
  doc.setTextColor(net > 0 ? 220 : net < 0 ? 200 : 60, net > 0 ? 38 : net < 0 ? 60 : 60, net > 0 ? 38 : net < 0 ? 60 : 60);
  doc.text((net > 0 ? "Customer Owes: " : net < 0 ? "You Owe: " : "") + inr(Math.abs(net)), pageW - margin - 4, y + 13, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`${data.transactions.length} entries`, margin + 4, y + 19);
  doc.text(net > 0 ? "Receivable" : net < 0 ? "Payable" : "Settled", pageW - margin - 4, y + 19, { align: "right" });

  y += 28;

  // Ledger heading
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TRANSACTION HISTORY", margin, y);
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Table header
  const colX = {
    date: margin,
    type: margin + 22,
    note: margin + 50,
    debit: pageW - margin - 38,
    credit: pageW - margin,
  };

  doc.setFillColor(245, 247, 252);
  doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text("DATE", colX.date + 1, y);
  doc.text("TYPE", colX.type, y, { align: "center" });
  doc.text("PARTICULARS", colX.note, y);
  doc.text("DEBIT", colX.debit, y, { align: "right" });
  doc.text("CREDIT", colX.credit, y, { align: "right" });
  y += 7;

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);

  const sorted = [...data.transactions].sort((a, b) => a.createdAt - b.createdAt);
  let pageNum = 1;

  for (const t of sorted) {
    if (y > pageH - 30) {
      doc.addPage();
      pageNum += 1;
      y = 20;
    }

    doc.setTextColor(110, 110, 110);
    doc.text(formatDate(t.createdAt), colX.date + 1, y);

    doc.setTextColor(t.type === "gave" ? 5 : 180, t.type === "gave" ? 150 : 30, t.type === "gave" ? 70 : 50);
    doc.setFont("helvetica", "bold");
    doc.text(t.type === "gave" ? "GAVE" : "GOT", colX.type, y, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    let noteLine = t.note || "";
    if (t.items && t.items.length > 0) {
      noteLine = noteLine
        ? `${noteLine} | ${t.items.map((i) => `${i.itemName} x${i.qty} ${unitLabel(i.unit)}`).join(", ")}`
        : t.items.map((i) => `${i.itemName} x${i.qty} ${unitLabel(i.unit)}`).join(", ");
    }
    const noteLines = doc.splitTextToSize(noteLine || "-", pageW - margin * 2 - (colX.note - colX.date) - 4);
    doc.text(noteLines.slice(0, 1), colX.note, y);

    if (t.type === "gave") {
      doc.setTextColor(5, 150, 70);
      doc.setFont("helvetica", "bold");
      doc.text(inr(t.amount), colX.debit, y, { align: "right" });
      doc.setTextColor(180, 30, 50);
      doc.text("-", colX.credit, y, { align: "right" });
    } else {
      doc.setTextColor(180, 30, 50);
      doc.setFont("helvetica", "bold");
      doc.text(inr(t.amount), colX.credit, y, { align: "right" });
      doc.setTextColor(5, 150, 70);
      doc.text("-", colX.debit, y, { align: "right" });
    }

    y += 6;
    doc.setDrawColor(238, 238, 238);
    doc.line(margin, y - 2, pageW - margin, y - 2);
  }

  // Totals row
  if (y > pageH - 30) {
    doc.addPage();
    pageNum += 1;
    y = 20;
  }
  y += 2;
  doc.setFillColor(26, 115, 232);
  doc.rect(margin, y - 4, pageW - margin * 2, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TOTALS", colX.date + 1, y);
  doc.text("", colX.type, y, { align: "center" });
  doc.text("", colX.note, y);
  doc.text(inr(gaveTotal), colX.debit, y, { align: "right" });
  doc.text(inr(gotTotal), colX.credit, y, { align: "right" });
  y += 8;

  // Footer on every page
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(
    `${business} · This is a computer-generated statement. Page ${pageNum}.`,
    pageW / 2,
    pageH - 10,
    { align: "center" }
  );

  const safeName = data.customer.name.replace(/[^a-z0-9]/gi, "_");
  const fileName = `Ledger_${safeName}_${Date.now()}.pdf`;
  doc.save(fileName);
  return fileName;
}