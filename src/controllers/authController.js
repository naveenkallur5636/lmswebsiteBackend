// src/controllers/authController.js
const { admin } = require("../services/firebaseService");
const mongoose = require("mongoose");
const Student = require("../models/studentModel");
const User = require("../models/userModel");

/**
 * Handles signup process for users.
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 *
 * @returns {Promise<void>}
 */
/**
 * @description
 * 1. Extract the Firebase ID token from the Authorization header.
 * 2. Verify the Firebase ID token to ensure it is valid.
 * 3. Get the user's Firebase UID from the decoded token.
 * 4. Check if a user with the same Firebase UID already exists in the database.
 *    a. If yes, return a 400 error with "User already exists" message.
 * 5. If no user with the same Firebase UID exists, create a new user document.
 * 6. Set the user's role to "student" by default, unless a valid role is provided in the request body.
 * 7. Set the user's approval status to "pending".
 * 8. Save the user document to the database.
 * 9. Return a 201 response with a success message and the user document.
 */
exports.signup = async (req, res) => {
  const authHeader = req.headers.authorization;
  const { access_token, class_id, phone_number, profile_image, refresh_token, role, studentDOB, studentGender, student_name, board_id, subject_id, type_of_batch, amount, duration,is_paid,paymentLink_status,gstAmount,discountAmount,mode } = req.body; // Get role from request body
  console.log(req.body);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Check if user already exists
    let user = await User.findOne({ auth_id: uid });

    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Set user role
    const userRole = ["student", "teacher", "admin"].includes(role)
      ? role
      : "student";

    // Create new user
    user = new User({
      auth_id: uid,
      email: decodedToken.email || null,
      name: student_name || "Anonymous",
      role: userRole,
      access_token: access_token,
      refresh_token: refresh_token,
      approval_status: "pending",
    });

    const createdUser = await user.save();

    // If the role is 'student', create a Student document
    let student;
    if (userRole === "student") {
      // Correctly format the subject_id array
    // const formattedSubjects = subject_id.map(subject => ({
    //   subject_id: mongoose.Types.ObjectId(subject.subject_id), // Ensure it's an ObjectId
    //   typeOfBatch: mongoose.Types.ObjectId(subject.typeOfBatch),
    //   duration: subject.duration
    // }));
      // Generate a unique student ID (e.g., use the user ID or a custom method)
      // const studentId = new mongoose.Types.ObjectId();

      student = new Student({
        auth_id: uid,
        student_id: user._id,
        user_id: user._id,
        role: "student",
        class: class_id,
        phone_number: phone_number,
        profile_image: profile_image,
        gender: studentGender,
        dateOfBirth: studentDOB,
        board_id: board_id,
        // subject_id: {
        //   _id: subject_id,
        //   duration: duration,
        //   type_of_batch: type_of_batch,
        // },
        subject_id: subject_id,
        type_of_batch: type_of_batch,
        amount: amount,
        duration: duration,
        is_paid: is_paid,
        mode:mode||'normal',
        paymentLink_status:paymentLink_status||'no_payment_link',
        gstAmount:gstAmount||null,
        discountAmount:discountAmount||null

      });
      await student.save();
    }

    res.status(201).json({
      message: "User account created successfully",
      user,
      student: student || null, // Include student info if created
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @description
 * 1. Extract the Firebase ID token from the Authorization header.
 * 2. Verify the Firebase ID token to ensure it is valid.
 * 3. Get the user's Firebase UID from the decoded token.
 * 4. Check if a user with the same Firebase UID already exists in the database.
 *    a. If no, return a 404 error with "User not found" message.
 * 5. If yes, return a 200 response with a success message and the user document.
 */
exports.signin = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Fetch user from database
    let user = await User.findOne({ auth_id: uid });

    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found. Please sign up first." });
    }

    res.status(200).json({ message: "User signed in successfully", user });
  } catch (error) {
    console.error("Error during signin:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Handles logout process for users.
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 *
 * @returns {Promise<void>}
 */
/**
 * @description
 * 1. Verify the Firebase ID token to ensure it is valid.
 * 2. Revoke all refresh tokens for the user.
 * 3. Return a 200 response with a success message.
 */
exports.logout = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Revoke refresh tokens for the user
    await admin.auth().revokeRefreshTokens(uid);

    res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
