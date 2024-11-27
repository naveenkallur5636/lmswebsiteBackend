const Meeting = require("../models/meetingModel");
const express = require("express");
const axios = require("axios"); // Corrected capitalization
const batch = require("../models/batchModel");
const Subject = require("../models/subjectModel");
const Teacher = require("../models/teacherModel");
exports.getMeetings = async (req, res) => {
  try {
    // Extract startDate and endDate from query parameters
    const { startDate, endDate } = req.query;

    // Initialize the date filter object
    let dateFilter = {};

    if (startDate || endDate) {
      dateFilter.created_at = {};

      // If startDate is provided, add $gte (greater than or equal) to dateFilter
      if (startDate) {
        dateFilter.created_at.$gte = new Date(startDate);
      }

      // If endDate is provided, add $lte (less than or equal) to dateFilter
      if (endDate) {
        // Set time to the end of the day for endDate
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.created_at.$lte = end;
      }
    }

    const meetings = await Meeting.find(dateFilter)
      .populate({
        path: "teacher_id",
        select: "user_id",
        populate: {
          path: "user_id",
          select: "name email",
        },
      })
      .populate({
        path: "batch",
        select: "batch_name",
      })
      .populate({
        path: "subject",
        select: "subject_name",
      })
      .populate({
        path: "students",
        select: "user_id",
        populate: {
          path: "user_id",
          select: "name email",
        },
      });

    res.status(200).json(meetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getMeetingsForTeacher = async (req, res) => {
  try {
    const meetings = await Meeting.find({ teacher_id: req.user._id })
      .populate("teacher_id", "name email")
      .populate("batch", "batch_name")
      .populate("subject", "subject_name")
      .populate("students", "user_id")
      .populate("students.user_id", "name email");
    res.status(200).json(meetings);
  } catch {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getMeetingForStudents = async (req, res) => {
  try {
    const meetings = await Meeting.find({ students: req.user._id })
      .populate("teacher_id", "name email")
      .populate("batch", "batch_name")
      .populate("subject", "subject_name")
      .populate("students", "user_id")
      .populate("students.user_id", "name email");
    res.status(200).json(meetings);
  } catch {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const getAccessToken = async () => {
  const url = `https://login.microsoftonline.com/4a18f542-e76b-4e64-b11b-22cf887e4659/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: "4374176d-7f91-4d83-a5e7-c44d06d12726",
    client_secret: "2rY8Q~~uzeAvhdFbCjfI5TLR3T~GLdJWEAQoTdi9",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await axios.post(url, params);
  return response.data.access_token;
};
exports.createMeetingTeams = async (req, res) => {
  try {
    const {
      email,
      startDate,
      endDate,
      recurrencePattern,
      teacher_id,
      batch_id,
      students,
      title, // Include the title for the meeting
    } = req.body;

    const token = await getAccessToken();

    const meetingDetails = {
      startDateTime: startDate,
      endDateTime: endDate,
      subject: title, // Add the meeting title to the Microsoft Graph API request
    };

    const graphResponse = await axios.post(
      "https://graph.microsoft.com/v1.0/users/bfa1bf61-f558-4089-b191-777c7bbb7851/onlineMeetings",
      meetingDetails,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { joinWebUrl, id } = graphResponse.data;

    const meetingData = {
      startDate: startDate,
      endDate: endDate,
      teacher_id: teacher_id,
      batch_id: batch_id,
      students: students, 
      recurrencePattern: recurrencePattern,
      meeting_link: joinWebUrl, // Store the meeting link correctly
      meetingId: id, // Store meeting ID for future reference
    };

    // Save meeting details to MongoDB
    const meeting = new Meeting(meetingData);

    await batch.findByIdAndUpdate(batch_id, {
      $set: { meeting_link: joinWebUrl },
    });

    await Teacher.findByIdAndUpdate(
      teacher_id,
      {
        $push: {
          schedule: {
            date: new Date(startDate),
            meeting_url: joinWebUrl,
            meeting_title: title,
          },
        },
      },
      { new: true }
    );

    await meeting.save();

    res.status(200).json({
      message: "Meeting created successfully",
      joinUrl: joinWebUrl,
      meetingId: id,
    });
  } catch (error) {
    console.error("Error creating recurring meeting:", error);
    res.status(500).json({ error: "Failed to create recurring meeting" });
  }
};

exports.getJoinUrl = async (req, res) => {
  try {
    const { meetingId } = req.params; // Get the meeting ID from the request
    const token = await getAccessToken();

    const graphResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { joinUrl } = graphResponse.data;

    res.status(200).json({ joinUrl }); // Return the join URL to the client
  } catch (error) {
    console.error("Error fetching join URL:", error);
    res.status(500).json({ error: "Failed to fetch join URL" });
  }
};


