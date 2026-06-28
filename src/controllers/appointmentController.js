const Appointment = require('../models/Appointment');
const Store = require('../models/Store');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { getPagination, formatPaginationResponse } = require('../utils/helpers');
const { sendAppointmentConfirmationEmail } = require('../utils/emailService');

/**
 * Create appointment
 * @route POST /api/appointments
 * @access Private (Customer)
 */
const createAppointment = asyncHandler(async (req, res) => {
  const {
    storeId,
    serviceType,
    serviceDetails,
    appointmentDate,
    appointmentTime,
    customerInfo,
    healthInfo,
  } = req.body;

  // Verify store exists and accepts appointments
  const store = await Store.findById(storeId);
  
  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found',
    });
  }

  if (!store.canAcceptAppointments()) {
    return res.status(400).json({
      success: false,
      message: 'Store is not accepting appointments at the moment',
      reason: store.subscriptionStatus !== 'active' ? 'Subscription expired' : 'Appointments temporarily disabled',
    });
  }

  // Check if appointment date is in the future
  const selectedDate = new Date(appointmentDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
    return res.status(400).json({
      success: false,
      message: 'Appointment date cannot be in the past',
    });
  }

  // Check for conflicting appointments (same store, date, and time)
  const conflictingAppointment = await Appointment.findOne({
    storeId,
    appointmentDate: selectedDate,
    appointmentTime,
    status: { $in: ['pending', 'confirmed', 'in_progress'] },
  });

  if (conflictingAppointment) {
    return res.status(400).json({
      success: false,
      message: 'This time slot is already booked. Please choose another time.',
    });
  }

  const appointment = await Appointment.create({
    customerId: req.user._id,
    storeId,
    serviceType,
    serviceDetails,
    appointmentDate: selectedDate,
    appointmentTime,
    customerInfo: {
      ...customerInfo,
      email: customerInfo.email || req.user.email,
      name: customerInfo.name || req.user.name,
      phone: customerInfo.phone || req.user.phone,
    },
    healthInfo,
  });

  await appointment.populate('storeId', 'name logo contactInfo address');

  // Send confirmation email
  await sendAppointmentConfirmationEmail(appointment, req.user);

  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully',
    data: { appointment },
  });
});

/**
 * Get appointment by ID
 * @route GET /api/appointments/:id
 * @access Private
 */
const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('customerId', 'name email phone')
    .populate('storeId', 'name logo contactInfo address');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
    });
  }

  // Authorization check
  const store = await Store.findById(appointment.storeId._id);
  const isAuthorized = 
    req.user._id.toString() === appointment.customerId._id.toString() ||
    req.user._id.toString() === store.distributorId.toString() ||
    req.user.role === 'superAdmin';

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this appointment',
    });
  }

  res.json({
    success: true,
    data: { appointment },
  });
});

/**
 * Get my appointments
 * @route GET /api/appointments/my/all
 * @access Private (Customer)
 */
const getMyAppointments = asyncHandler(async (req, res) => {
  const { page, limit, status, upcoming } = req.query;
  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);

  const query = { customerId: req.user._id };
  
  if (status) {
    query.status = status;
  }

  if (upcoming === 'true') {
    query.appointmentDate = { $gte: new Date() };
    query.status = { $in: ['pending', 'confirmed'] };
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate('storeId', 'name logo address')
      .skip(skip)
      .limit(pageLimit)
      .sort({ appointmentDate: upcoming === 'true' ? 1 : -1 }),
    Appointment.countDocuments(query),
  ]);

  res.json({
    success: true,
    ...formatPaginationResponse(appointments, total, pageNum, pageLimit),
  });
});

/**
 * Get store appointments
 * @route GET /api/appointments/store/:storeId
 * @access Private (Store Owner)
 */
const getStoreAppointments = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { page, limit, status, date } = req.query;
  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);

  const query = { storeId };
  
  if (status) query.status = status;
  
  if (date) {
    const selectedDate = new Date(date);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    query.appointmentDate = { $gte: startOfDay, $lte: endOfDay };
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate('customerId', 'name email phone')
      .skip(skip)
      .limit(pageLimit)
      .sort({ appointmentDate: 1, appointmentTime: 1 }),
    Appointment.countDocuments(query),
  ]);

  res.json({
    success: true,
    ...formatPaginationResponse(appointments, total, pageNum, pageLimit),
  });
});

/**
 * Update appointment status
 * @route PUT /api/appointments/:id/status
 * @access Private (Store Owner)
 */
const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const appointment = await Appointment.findById(req.params.id).populate('storeId');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
    });
  }

  // Authorization check
  const store = await Store.findById(appointment.storeId._id);
  const isStoreOwner = store.distributorId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'superAdmin';

  if (!isStoreOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this appointment',
    });
  }

  await appointment.updateStatus(status, note, req.user._id);

  res.json({
    success: true,
    message: 'Appointment status updated successfully',
    data: { appointment },
  });
});

/**
 * Confirm appointment
 * @route PUT /api/appointments/:id/confirm
 * @access Private (Store Owner)
 */
const confirmAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate('storeId');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
    });
  }

  await appointment.confirm(req.user._id);

  res.json({
    success: true,
    message: 'Appointment confirmed successfully',
    data: { appointment },
  });
});

/**
 * Complete appointment with results
 * @route PUT /api/appointments/:id/complete
 * @access Private (Store Owner)
 */
const completeAppointment = asyncHandler(async (req, res) => {
  const { results } = req.body;

  const appointment = await Appointment.findById(req.params.id).populate('storeId');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
    });
  }

  await appointment.complete(results, req.user._id);

  res.json({
    success: true,
    message: 'Appointment completed successfully',
    data: { appointment },
  });
});

/**
 * Cancel appointment
 * @route PUT /api/appointments/:id/cancel
 * @access Private (Customer/Store Owner)
 */
const cancelAppointment = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const appointment = await Appointment.findById(req.params.id).populate('storeId');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
    });
  }

  // Authorization check
  const store = await Store.findById(appointment.storeId._id);
  const isCustomer = appointment.customerId.toString() === req.user._id.toString();
  const isStoreOwner = store.distributorId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'superAdmin';

  if (!isCustomer && !isStoreOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this appointment',
    });
  }

  if (!appointment.canBeCancelled()) {
    return res.status(400).json({
      success: false,
      message: 'Appointment cannot be cancelled in its current status',
      currentStatus: appointment.status,
    });
  }

  await appointment.cancel(reason, req.user._id);

  res.json({
    success: true,
    message: 'Appointment cancelled successfully',
    data: { appointment },
  });
});

/**
 * Reschedule appointment
 * @route PUT /api/appointments/:id/reschedule
 * @access Private (Customer/Store Owner)
 */
const rescheduleAppointment = asyncHandler(async (req, res) => {
  const { appointmentDate, appointmentTime } = req.body;

  const appointment = await Appointment.findById(req.params.id).populate('storeId');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
    });
  }

  if (!appointment.canBeRescheduled()) {
    return res.status(400).json({
      success: false,
      message: 'Appointment cannot be rescheduled in its current status',
      currentStatus: appointment.status,
    });
  }

  // Check for conflicts
  const conflictingAppointment = await Appointment.findOne({
    storeId: appointment.storeId,
    appointmentDate: new Date(appointmentDate),
    appointmentTime,
    status: { $in: ['pending', 'confirmed', 'in_progress'] },
    _id: { $ne: appointment._id },
  });

  if (conflictingAppointment) {
    return res.status(400).json({
      success: false,
      message: 'This time slot is already booked. Please choose another time.',
    });
  }

  appointment.appointmentDate = new Date(appointmentDate);
  appointment.appointmentTime = appointmentTime;
  
  await appointment.updateStatus('pending', 'Appointment rescheduled', req.user._id);

  res.json({
    success: true,
    message: 'Appointment rescheduled successfully',
    data: { appointment },
  });
});

/**
 * Get available time slots for a date
 * @route GET /api/appointments/available-slots/:storeId
 * @access Public
 */
const getAvailableTimeSlots = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Date is required',
    });
  }

  const store = await Store.findById(storeId);
  
  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found',
    });
  }

  const selectedDate = new Date(date);
  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get booked appointments for the date
  const bookedAppointments = await Appointment.find({
    storeId,
    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed', 'in_progress'] },
  }).select('appointmentTime');

  const bookedTimes = bookedAppointments.map(apt => apt.appointmentTime);

  // Generate available time slots (e.g., 9:00 AM to 5:00 PM, 30-minute intervals)
  const timeSlots = [];
  for (let hour = 9; hour < 17; hour++) {
    for (let minute of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeSlots.push({
        time,
        available: !bookedTimes.includes(time),
      });
    }
  }

  res.json({
    success: true,
    data: {
      date: selectedDate,
      timeSlots,
      bookedCount: bookedTimes.length,
    },
  });
});

module.exports = {
  createAppointment,
  getAppointment,
  getMyAppointments,
  getStoreAppointments,
  updateAppointmentStatus,
  confirmAppointment,
  completeAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getAvailableTimeSlots,
};