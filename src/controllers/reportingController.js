const Report = require('../models/Report');
const Order = require('../models/Order');
const DriverEarning = require('../models/DriverEarning');
const Subscription = require('../models/Subscription');
const Appointment = require('../models/Appointment');
const Store = require('../models/Store');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { getDateRange } = require('../utils/helpers');
const ExcelJS = require('exceljs');
const { createObjectCsvWriter } = require('csv-writer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate distributor purchases report
 * @route POST /api/reports/distributor-purchases
 * @access Private (Super Admin)
 */
const generateDistributorPurchasesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, distributorCode, format = 'excel' } = req.body;

  const query = {
    buyerType: 'distributor',
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  if (distributorCode) {
    query.distributorCode = distributorCode;
  }

  const orders = await Order.find(query)
    .populate('customerId', 'name email distributorCode')
    .populate('storeId', 'name')
    .sort({ createdAt: -1 });

  // Calculate summary
  const summary = {
    totalOrders: orders.length,
    totalAmount: orders.reduce((sum, order) => sum + order.total, 0),
    totalItems: orders.reduce((sum, order) => sum + order.items.length, 0),
  };

  // Create report record
  const report = await Report.create({
    reportType: 'distributor_purchases',
    title: 'Distributor Purchases Report',
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    filters: { distributorCode },
    data: orders,
    summary,
    generatedBy: req.user._id,
    fileFormat: format,
    status: 'processing',
  });

  // Generate file based on format
  let fileUrl;
  
  if (format === 'excel') {
    fileUrl = await generateExcelReport(orders, summary, 'distributor_purchases', report._id);
  } else if (format === 'csv') {
    fileUrl = await generateCSVReport(orders, 'distributor_purchases', report._id);
  } else if (format === 'pdf') {
    fileUrl = await generatePDFReport(orders, summary, 'Distributor Purchases', report._id);
  }

  const fileSize = fs.statSync(fileUrl).size;
  await report.markAsCompleted(fileUrl, fileSize);

  res.json({
    success: true,
    message: 'Report generated successfully',
    data: { report },
  });
});

/**
 * Generate store sales report
 * @route POST /api/reports/store-sales
 * @access Private (Store Owner/Super Admin)
 */
const generateStoreSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, storeId, format = 'excel' } = req.body;

  const query = {
    storeId,
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  const orders = await Order.find(query)
    .populate('customerId', 'name email phone')
    .sort({ createdAt: -1 });

  const summary = {
    totalOrders: orders.length,
    totalAmount: orders.reduce((sum, order) => sum + order.total, 0),
    totalDeliveryFees: orders.reduce((sum, order) => sum + order.deliveryFee, 0),
    byStatus: {},
    byPaymentMethod: {},
  };

  // Group by status
  orders.forEach(order => {
    summary.byStatus[order.orderStatus] = (summary.byStatus[order.orderStatus] || 0) + 1;
    summary.byPaymentMethod[order.paymentMethod] = (summary.byPaymentMethod[order.paymentMethod] || 0) + 1;
  });

  const report = await Report.create({
    reportType: 'store_sales',
    title: 'Store Sales Report',
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    filters: { storeId },
    data: orders,
    summary,
    generatedBy: req.user._id,
    fileFormat: format,
    status: 'processing',
  });

  let fileUrl;
  
  if (format === 'excel') {
    fileUrl = await generateExcelReport(orders, summary, 'store_sales', report._id);
  } else if (format === 'csv') {
    fileUrl = await generateCSVReport(orders, 'store_sales', report._id);
  } else if (format === 'pdf') {
    fileUrl = await generatePDFReport(orders, summary, 'Store Sales', report._id);
  }

  const fileSize = fs.statSync(fileUrl).size;
  await report.markAsCompleted(fileUrl, fileSize);

  res.json({
    success: true,
    message: 'Report generated successfully',
    data: { report },
  });
});

/**
 * Generate driver earnings report
 * @route POST /api/reports/driver-earnings
 * @access Private (Super Admin)
 */
const generateDriverEarningsReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, driverId, payoutStatus, format = 'excel' } = req.body;

  const query = {
    deliveryDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  if (driverId) query.driverId = driverId;
  if (payoutStatus) query.payoutStatus = payoutStatus;

  const earnings = await DriverEarning.find(query)
    .populate('driverId')
    .populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'name email phone' },
    })
    .populate('orderId', 'orderNumber')
    .sort({ deliveryDate: -1 });

  const summary = {
    totalDeliveries: earnings.length,
    totalDeliveryFees: earnings.reduce((sum, e) => sum + e.deliveryFee, 0),
    totalDriverEarnings: earnings.reduce((sum, e) => sum + e.driverAmount, 0),
    totalPlatformEarnings: earnings.reduce((sum, e) => sum + e.platformAmount, 0),
    pendingPayouts: earnings.filter(e => e.payoutStatus === 'pending').reduce((sum, e) => sum + e.netAmount, 0),
    paidPayouts: earnings.filter(e => e.payoutStatus === 'paid').reduce((sum, e) => sum + e.netAmount, 0),
  };

  const report = await Report.create({
    reportType: 'driver_earnings',
    title: 'Driver Earnings Report',
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    filters: { driverId, payoutStatus },
    data: earnings,
    summary,
    generatedBy: req.user._id,
    fileFormat: format,
    status: 'processing',
  });

  let fileUrl;
  
  if (format === 'excel') {
    fileUrl = await generateDriverEarningsExcel(earnings, summary, report._id);
  } else if (format === 'csv') {
    fileUrl = await generateDriverEarningsCSV(earnings, report._id);
  }

  const fileSize = fs.statSync(fileUrl).size;
  await report.markAsCompleted(fileUrl, fileSize);

  res.json({
    success: true,
    message: 'Report generated successfully',
    data: { report },
  });
});

/**
 * Generate subscription report
 * @route POST /api/reports/subscriptions
 * @access Private (Super Admin)
 */
const generateSubscriptionReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, status, format = 'excel' } = req.body;

  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  if (status) query.status = status;

  const subscriptions = await Subscription.find(query)
    .populate('storeId', 'name slug')
    .sort({ createdAt: -1 });

  const summary = {
    totalSubscriptions: subscriptions.length,
    totalRevenue: subscriptions.filter(s => s.paymentStatus === 'paid').reduce((sum, s) => sum + s.amount, 0),
    activeSubscriptions: subscriptions.filter(s => s.status === 'active').length,
    expiredSubscriptions: subscriptions.filter(s => s.status === 'expired').length,
  };

  const report = await Report.create({
    reportType: 'subscriptions',
    title: 'Subscription Report',
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    filters: { status },
    data: subscriptions,
    summary,
    generatedBy: req.user._id,
    fileFormat: format,
    status: 'processing',
  });

  let fileUrl;
  
  if (format === 'excel') {
    fileUrl = await generateSubscriptionExcel(subscriptions, summary, report._id);
  } else if (format === 'csv') {
    fileUrl = await generateSubscriptionCSV(subscriptions, report._id);
  }

  const fileSize = fs.statSync(fileUrl).size;
  await report.markAsCompleted(fileUrl, fileSize);

  res.json({
    success: true,
    message: 'Report generated successfully',
    data: { report },
  });
});

/**
 * Generate appointment report
 * @route POST /api/reports/appointments
 * @access Private (Store Owner/Super Admin)
 */
const generateAppointmentReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, storeId, status, format = 'excel' } = req.body;

  const query = {
    appointmentDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  if (storeId) query.storeId = storeId;
  if (status) query.status = status;

  const appointments = await Appointment.find(query)
    .populate('customerId', 'name email phone')
    .populate('storeId', 'name')
    .sort({ appointmentDate: -1 });

  const summary = {
    totalAppointments: appointments.length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    noShow: appointments.filter(a => a.status === 'no_show').length,
    byServiceType: {},
  };

  appointments.forEach(apt => {
    summary.byServiceType[apt.serviceType] = (summary.byServiceType[apt.serviceType] || 0) + 1;
  });

  const report = await Report.create({
    reportType: 'appointments',
    title: 'Appointment Report',
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    filters: { storeId, status },
    data: appointments,
    summary,
    generatedBy: req.user._id,
    fileFormat: format,
    status: 'processing',
  });

  let fileUrl;
  
  if (format === 'excel') {
    fileUrl = await generateAppointmentExcel(appointments, summary, report._id);
  } else if (format === 'csv') {
    fileUrl = await generateAppointmentCSV(appointments, report._id);
  }

  const fileSize = fs.statSync(fileUrl).size;
  await report.markAsCompleted(fileUrl, fileSize);

  res.json({
    success: true,
    message: 'Report generated successfully',
    data: { report },
  });
});

/**
 * Get my reports
 * @route GET /api/reports/my/all
 * @access Private
 */
const getMyReports = asyncHandler(async (req, res) => {
  const { reportType } = req.query;

  const reports = await Report.findByUser(req.user._id, { reportType });

  res.json({
    success: true,
    data: { reports, count: reports.length },
  });
});

/**
 * Download report
 * @route GET /api/reports/:id/download
 * @access Private
 */
const downloadReport = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'Report not found',
    });
  }

  // Authorization check
  if (report.generatedBy.toString() !== req.user._id.toString() && req.user.role !== 'superAdmin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to download this report',
    });
  }

  if (!report.fileUrl || !fs.existsSync(report.fileUrl)) {
    return res.status(404).json({
      success: false,
      message: 'Report file not found',
    });
  }

  res.download(report.fileUrl, path.basename(report.fileUrl));
});

// Helper functions for generating files

async function generateExcelReport(data, summary, reportType, reportId) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  // Add headers based on report type
  if (reportType === 'distributor_purchases' || reportType === 'store_sales') {
    worksheet.columns = [
      { header: 'Order Number', key: 'orderNumber', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Items', key: 'items', width: 10 },
      { header: 'Subtotal', key: 'subtotal', width: 15 },
      { header: 'Delivery Fee', key: 'deliveryFee', width: 15 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    data.forEach(order => {
      worksheet.addRow({
        orderNumber: order.orderNumber,
        date: order.createdAt.toLocaleDateString(),
        customer: order.customerId?.name || 'N/A',
        items: order.items.length,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        status: order.orderStatus,
      });
    });
  }

  // Add summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['Report Summary']);
  summarySheet.addRow(['Total Records', summary.totalOrders || summary.totalDeliveries || data.length]);
  summarySheet.addRow(['Total Amount', summary.totalAmount || summary.totalRevenue || 0]);

  const fileName = `${reportType}_${reportId}.xlsx`;
  const filePath = path.join('./uploads/reports', fileName);

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function generateCSVReport(data, reportType, reportId) {
  const fileName = `${reportType}_${reportId}.csv`;
  const filePath = path.join('./uploads/reports', fileName);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'orderNumber', title: 'Order Number' },
      { id: 'date', title: 'Date' },
      { id: 'customer', title: 'Customer' },
      { id: 'total', title: 'Total' },
      { id: 'status', title: 'Status' },
    ],
  });

  const records = data.map(order => ({
    orderNumber: order.orderNumber,
    date: order.createdAt.toLocaleDateString(),
    customer: order.customerId?.name || 'N/A',
    total: order.total,
    status: order.orderStatus,
  }));

  await csvWriter.writeRecords(records);
  return filePath;
}

async function generatePDFReport(data, summary, title, reportId) {
  const fileName = `${title.replace(/\s+/g, '_')}_${reportId}.pdf`;
  const filePath = path.join('./uploads/reports', fileName);

  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(20).text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Total Records: ${data.length}`);
  doc.text(`Total Amount: ${summary.totalAmount || 0}`);
  doc.moveDown();

  doc.fontSize(10);
  data.slice(0, 50).forEach((item, index) => {
    doc.text(`${index + 1}. ${item.orderNumber} - ${item.total}`, { continued: false });
  });

  doc.end();
  return filePath;
}

async function generateDriverEarningsExcel(earnings, summary, reportId) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Driver Earnings');

  worksheet.columns = [
    { header: 'Driver Name', key: 'driverName', width: 25 },
    { header: 'Order Number', key: 'orderNumber', width: 20 },
    { header: 'Delivery Date', key: 'deliveryDate', width: 15 },
    { header: 'Delivery Fee', key: 'deliveryFee', width: 15 },
    { header: 'Driver Amount', key: 'driverAmount', width: 15 },
    { header: 'Platform Amount', key: 'platformAmount', width: 15 },
    { header: 'Payout Status', key: 'payoutStatus', width: 15 },
  ];

  earnings.forEach(earning => {
    worksheet.addRow({
      driverName: earning.driverId?.userId?.name || 'N/A',
      orderNumber: earning.orderId?.orderNumber || 'N/A',
      deliveryDate: earning.deliveryDate.toLocaleDateString(),
      deliveryFee: earning.deliveryFee,
      driverAmount: earning.driverAmount,
      platformAmount: earning.platformAmount,
      payoutStatus: earning.payoutStatus,
    });
  });

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['Total Deliveries', summary.totalDeliveries]);
  summarySheet.addRow(['Total Driver Earnings', summary.totalDriverEarnings]);
  summarySheet.addRow(['Total Platform Earnings', summary.totalPlatformEarnings]);
  summarySheet.addRow(['Pending Payouts', summary.pendingPayouts]);

  const fileName = `driver_earnings_${reportId}.xlsx`;
  const filePath = path.join('./uploads/reports', fileName);

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function generateDriverEarningsCSV(earnings, reportId) {
  const fileName = `driver_earnings_${reportId}.csv`;
  const filePath = path.join('./uploads/reports', fileName);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'driverName', title: 'Driver Name' },
      { id: 'orderNumber', title: 'Order Number' },
      { id: 'deliveryDate', title: 'Delivery Date' },
      { id: 'driverAmount', title: 'Driver Amount' },
      { id: 'payoutStatus', title: 'Payout Status' },
    ],
  });

  const records = earnings.map(earning => ({
    driverName: earning.driverId?.userId?.name || 'N/A',
    orderNumber: earning.orderId?.orderNumber || 'N/A',
    deliveryDate: earning.deliveryDate.toLocaleDateString(),
    driverAmount: earning.driverAmount,
    payoutStatus: earning.payoutStatus,
  }));

  await csvWriter.writeRecords(records);
  return filePath;
}

async function generateSubscriptionExcel(subscriptions, summary, reportId) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Subscriptions');

  worksheet.columns = [
    { header: 'Store Name', key: 'storeName', width: 25 },
    { header: 'Start Date', key: 'startDate', width: 15 },
    { header: 'Expiry Date', key: 'expiryDate', width: 15 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Payment Status', key: 'paymentStatus', width: 15 },
  ];

  subscriptions.forEach(sub => {
    worksheet.addRow({
      storeName: sub.storeId?.name || 'N/A',
      startDate: sub.startDate.toLocaleDateString(),
      expiryDate: sub.expiryDate.toLocaleDateString(),
      amount: sub.amount,
      status: sub.status,
      paymentStatus: sub.paymentStatus,
    });
  });

  const fileName = `subscriptions_${reportId}.xlsx`;
  const filePath = path.join('./uploads/reports', fileName);

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function generateSubscriptionCSV(subscriptions, reportId) {
  const fileName = `subscriptions_${reportId}.csv`;
  const filePath = path.join('./uploads/reports', fileName);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'storeName', title: 'Store Name' },
      { id: 'amount', title: 'Amount' },
      { id: 'status', title: 'Status' },
      { id: 'expiryDate', title: 'Expiry Date' },
    ],
  });

  const records = subscriptions.map(sub => ({
    storeName: sub.storeId?.name || 'N/A',
    amount: sub.amount,
    status: sub.status,
    expiryDate: sub.expiryDate.toLocaleDateString(),
  }));

  await csvWriter.writeRecords(records);
  return filePath;
}

async function generateAppointmentExcel(appointments, summary, reportId) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Appointments');

  worksheet.columns = [
    { header: 'Appointment Number', key: 'appointmentNumber', width: 20 },
    { header: 'Customer', key: 'customer', width: 25 },
    { header: 'Service Type', key: 'serviceType', width: 20 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Time', key: 'time', width: 10 },
    { header: 'Status', key: 'status', width: 15 },
  ];

  appointments.forEach(apt => {
    worksheet.addRow({
      appointmentNumber: apt.appointmentNumber,
      customer: apt.customerId?.name || 'N/A',
      serviceType: apt.serviceType,
      date: apt.appointmentDate.toLocaleDateString(),
      time: apt.appointmentTime,
      status: apt.status,
    });
  });

  const fileName = `appointments_${reportId}.xlsx`;
  const filePath = path.join('./uploads/reports', fileName);

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function generateAppointmentCSV(appointments, reportId) {
  const fileName = `appointments_${reportId}.csv`;
  const filePath = path.join('./uploads/reports', fileName);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'appointmentNumber', title: 'Appointment Number' },
      { id: 'customer', title: 'Customer' },
      { id: 'serviceType', title: 'Service Type' },
      { id: 'status', title: 'Status' },
    ],
  });

  const records = appointments.map(apt => ({
    appointmentNumber: apt.appointmentNumber,
    customer: apt.customerId?.name || 'N/A',
    serviceType: apt.serviceType,
    status: apt.status,
  }));

  await csvWriter.writeRecords(records);
  return filePath;
}

module.exports = {
  generateDistributorPurchasesReport,
  generateStoreSalesReport,
  generateDriverEarningsReport,
  generateSubscriptionReport,
  generateAppointmentReport,
  getMyReports,
  downloadReport,
};