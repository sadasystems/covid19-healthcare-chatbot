/**
 * Copyright 2021, SADA, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 'use strict';

 require('@google-cloud/trace-agent').start();
 
 // For Firestore database
 const admin = require('firebase-admin');
 const functions = require('firebase-functions');
 
 admin.initializeApp(functions.config().firebase);
 admin.firestore().settings({
     timestampsInSnapshots: true
 })
 
 const db = admin.firestore();
 
 //For sending emails
 const nodemailer = require('nodemailer');
 
 //For generating QR code
 const QRCode = require('qrcode')
 
 const express = require('express');
 const bodyParser = require('body-parser')
 const app = express();
 
 app.use(bodyParser.json())
 app.use(bodyParser.urlencoded({
     extended: true
 }))
 
 const moment = require('moment');
 const math = require('mathjs');
 
 /**
  * Validate Visitor account using email address
  * 
  * @param {*} req 
  * @param {*} res 
  * @returns 
  */
 async function validateAccountUsingEmail(req, res) {
 
     var accountVerified;
     var visitorReferenceId;
     var visitorFName;
     var visitorLName;
     var visitorEmpId;

     let visitorEmail = req.body.sessionInfo.parameters.visitor_email;
     console.log('validateAccountUsingEmail was triggered for email:' + visitorEmail);
 
     console.log('MODE: ' + process.env.MODE);
     if (process.env.MODE == 'trial') {
         accountVerified = 'true';
         visitorReferenceId = 'mode-trial';
     } else {
 
         // Create a reference to the user-data collection
         const userdataRef = db.collection('user-data');
 
         // Create a query against the collection to see f user exist with the said email
         let user = [];
 
         await userdataRef.where('email', '==', visitorEmail.toLowerCase())
             .get()
             .then(function(querySnapshot) {
                 querySnapshot.forEach(function(doc) {
                     visitorReferenceId = doc.id;
                     visitorEmpId = doc.empid;
                     visitorFName = doc.data().firstname;
                     visitorLName = doc.data().lastname;
                     user.push(doc.data());
                 });
                 return;
             })
             .catch(function(error) {
                 console.log("Error getting user-data documents: ", error);
             });
 
        console.log("user.length: " + user.length);

         if (!user.length) {
             accountVerified = 'false';
         } else {
             accountVerified = 'true';
         }

         console.log("Account verified: " + accountVerified);
     }
 
     console.log(' account verified: ' + accountVerified + ' for user: ' + visitorFName);
 
     return res.status(200).send({
         sessionInfo: {
             parameters: {
                 account_verified: accountVerified,
                 visitor_reference_id: visitorReferenceId === undefined ? null : visitorReferenceId,
                 employee_id: visitorEmpId === undefined ? null : visitorEmpId,
                 visitor_fname: visitorFName === undefined ? null : visitorFName,
                 visitor_lname: visitorLName === undefined ? null : visitorLName,
             }
         }
     });
 }
 
 /**
  * Validate Visitor account using employee ID
  * 
  * @param {*} req 
  * @param {*} res 
  * @returns 
  */
 async function validateAccountUsingEmpId(req, res) {
 
     var accountVerified;
     var visitorReferenceId;
     var visitorEmail;
     var visitorFName;
     var visitorLName;

     let visitorEmpId = req.body.sessionInfo.parameters.employee_id;
     console.log('validateAccountUsingEmpId was triggered for empId:' + visitorEmpId);
 
     console.log('MODE: ' + process.env.MODE);
     if (process.env.MODE == 'trial') {
         accountVerified = 'true';
         visitorReferenceId = 'mode-dev';
     } else {
 
         // Create a reference to the cities collection
         const userdataRef = db.collection('user-data');
 
         // Create a query against the collection to see f user exist with the said employee Id
         let user = [];
 
         await userdataRef.where('empid', '==', visitorEmpId)
             .get()
             .then(function(querySnapshot) {
                 querySnapshot.forEach(function(doc) {
                     visitorReferenceId = doc.id;
                     visitorEmail = doc.email;
                     visitorFName = doc.data().firstname;
                     visitorLName = doc.data().lastname;
                     user.push(doc.data());
                 });
                 return;
             })
             .catch(function(error) {
                 console.log('validateAccountUsingEmpId, Error getting user-data documents of empId: ' + visitorEmpId, error);
             });
 
         if (!user.length) {
             accountVerified = 'false';
         } else {
             accountVerified = 'true';
         }
     }
 
     console.log('validateAccountUsingEmpId, account verified: ' + accountVerified + 'of user: ' + visitorFName);
 
     return res.status(200).send({
         sessionInfo: {
             parameters: {
                 account_verified: accountVerified,
                 visitor_reference_id: visitorReferenceId === undefined ? null : visitorReferenceId,
                 visitor_email: visitorEmail === undefined ? null : visitorEmail,
                 visitor_fname: visitorFName === undefined ? null : visitorFName,
                 visitor_lname: visitorLName === undefined ? null : visitorLName,
             }
         }
     });
 }
 
 /**
  * Load last clearance pass of a visitor
  * 
  * @param {*} req 
  * @param {*} res 
  * @returns 
  */
 async function loadRecentPass(req, res) {
 
     let visitorEmail = req.body.sessionInfo.parameters.visitor_email;
     let visitorEmpId = req.body.sessionInfo.parameters.employee_id;
     let visitorReferenceId = req.body.sessionInfo.parameters.visitor_reference_id;
     let accountVerified = req.body.sessionInfo.parameters.account_verified;
     console.log('loadRecentPass was triggered for email:' + visitorEmail + ' or empId:' + visitorEmpId + ' on a verified account:' + accountVerified);
 
     var previousPassValid = 'false';
     var expiringInHours = 0;
 
     console.log('MODE: ' + process.env.MODE);
     if (process.env.MODE == 'trial') {
 
         return res.status(200).send({
             sessionInfo: {
                 parameters: {
                     previous_pass_valid: 'false',
                     expiring_in_hours: expiringInHours,
                     expiry_datetime: null,
                     supv_approval_required: 'false'
                 }
             }
         });
 
     } else {
 
         if (accountVerified === 'true' && visitorReferenceId != undefined) {
 
             // check database to see if the last pass issued (if any) is still valid
             // Create a reference to the collection "user-data/docid/clearance-pass-data"
             const userPassDataRef = db.collection('user-data/' + visitorReferenceId + '/clearance-pass-data');
 
             let previousPassExpDateTime;
             let supvApprovalRequired;
             let previousPassExpDateTimeDisplay;
             var currentTime = admin.firestore.Timestamp.fromDate(new Date());
 
             // Create a query against the collection
             await userPassDataRef.where('expirationdate', '>', currentTime)
                 .orderBy('expirationdate', 'desc').limit(1)
                 .get()
                 .then(function(querySnapshot) {
                     querySnapshot.forEach(function(doc) {
                         previousPassExpDateTime = doc.data().expirationdate;
                         supvApprovalRequired = doc.data().supvapprovalrequired;
                         console.log('loadRecentPass, previousPassExpDateTime: ' + previousPassExpDateTime);
                     });
                     return;
                 })
                 .catch(function(error) {
                     console.log('loadRecentPass, Error getting recent passes on visitorReferenceId: ' + visitorReferenceId, error);
                 });
 
             console.log('loadRecentPass, check for how long the previous pass is still valid: currentTime=' + currentTime);
             let duration = previousPassExpDateTime - currentTime;
             console.log('loadRecentPass, remaining pass duration:' + duration);
             let hours = math.floor((duration / (60 * 60)));
             console.log('loadRecentPass, remaining hours:' + hours);
             if (hours > 0) {
                 expiringInHours = hours;
                 previousPassValid = 'true';
                 previousPassExpDateTimeDisplay = moment(previousPassExpDateTime.toDate()).format('dddd, MMMM Do YYYY, h:mm a')
             }
 
             return res.status(200).send({
                 sessionInfo: {
                     parameters: {
                         previous_pass_valid: previousPassValid,
                         expiring_in_hours: expiringInHours,
                         expiry_datetime: previousPassExpDateTimeDisplay === undefined ? null : previousPassExpDateTimeDisplay,
                         supv_approval_required: supvApprovalRequired
                     }
                 }
             });
 
             console.log('loadRecentPass, previous pass validity: ' + previousPassValid + ' and expiring in ' + expiringInHours + ' hours');
 
         } else {
             console.error('loadRecentPass was triggered on an unverified account, email:' + visitorEmail + ' or empId:' + visitorEmpId);
         }
     }
 }
 
 /**
  * Generate Clearance Pass for vistors
  * 
  * @param {*} req 
  * @param {*} res 
  * @returns 
  */
 async function generatePass(req, res) {
 
     let visitorEmail = req.body.sessionInfo.parameters.visitor_email;
     let visitorEmpId = req.body.sessionInfo.parameters.employee_id;
     let visitorFName = req.body.sessionInfo.parameters.visitor_fname;
     let visitorLName = req.body.sessionInfo.parameters.visitor_lname;
     let visitorReferenceId = req.body.sessionInfo.parameters.visitor_reference_id;
     let accountVerified = req.body.sessionInfo.parameters.account_verified;
 
     let isFullyVaccinated = req.body.sessionInfo.parameters.is_fully_vaccinated;
     let inCloseContact = req.body.sessionInfo.parameters.in_close_contact;
     let hasCovid19Symptoms = req.body.sessionInfo.parameters.has_covid19_symptoms;
     let supvApprovalRequired = (isFullyVaccinated == 'true' && inCloseContact == 'true' && hasCovid19Symptoms == 'false') ? 'true' : 'false';
     let expiringInHours = 12;
 
     console.log('generatePass was triggered for email:' + visitorEmail + ' or empId:' + visitorEmpId + ' on a verified account:' + accountVerified);
 
     console.log('MODE: ' + process.env.MODE);
     if (process.env.MODE == 'trial') {
 
         return res.status(200).send({
             sessionInfo: {
                 parameters: {
                     expiring_in_hours: expiringInHours,
                     expiry_datetime: moment(moment().add(expiringInHours, 'hours').toDate()).format('dddd, MMMM Do YYYY, h:mm a'),
                     supv_approval_required: 'false'
                 }
             }
         });
 
     } else {
 
         let expiryDateTime;
         if (accountVerified === 'true') {
 
             //save this in the database
             console.log('generatePass, adding user to firestore DB...');
             expiryDateTime = moment().add(expiringInHours, 'hours');
 
             // generate new pass and save it as new entry in the database
             // Create a reference to the collection "user-data/docid/clearance-pass-data"
             const userPassDataRef = db.collection('user-data/' + visitorReferenceId + '/clearance-pass-data');
 
             const data = {
                 fullyvaccinated: isFullyVaccinated,
                 closecontact: inCloseContact,
                 covid19Symptoms: hasCovid19Symptoms,
                 createddate: moment(),
                 expirationdate: expiryDateTime,
                 supvapprovalrequired: supvApprovalRequired
             };
 
             var session = req.body.sessionInfo.session.split("/").pop();
             await userPassDataRef.doc(session)
                 .set(data)
                 .catch(function(error) {
                     console.log('generatePass, Error setting new pass for visitorReferenceId: ' + visitorReferenceId, error);
                 });
 
             console.log('generatePass, done adding user to firestore DB...');
 
             console.log('email enabled: ' + process.env.ENABLE_MAIL);
             if (process.env.ENABLE_MAIL == "True") {
 
                 //generate QR code
                 console.log('generateQRCode for the visitor...');
                 const qrCode = await generateQRCode(visitorEmpId, visitorEmail, visitorFName, visitorLName, data);
 
                 //send email to user with QR code
                 console.log('sendMail to the user...');
                 sendMail(expiryDateTime, supvApprovalRequired, visitorEmail, visitorFName, visitorLName, qrCode);
 
             } else {
 
                 console.log('WARNING: Please configure env variables in app.yaml file for sending email with digital clearance pass to the visitor...');
             }
 
         } else {
             console.error('generatePass was triggered on an unverified account, email:' + visitorEmail + ' or empId:' + visitorEmpId);
         }
 
         console.log('generatePass, new pass will expire in ' + expiringInHours + ' hours');
 
         return res.status(200).send({
             sessionInfo: {
                 parameters: {
                     expiring_in_hours: expiringInHours,
                     expiry_datetime: expiryDateTime === undefined ? null : moment(expiryDateTime.toDate()).format('dddd, MMMM Do YYYY, h:mm a'),
                     supv_approval_required: supvApprovalRequired
                 }
             }
         });
     }
 }
 
 /**
  * Generate a QR code for Digital Clearance Pass
  * 
  * @param {*} visitorEmpId 
  * @param {*} visitorEmail 
  * @param {*} visitorFName 
  * @param {*} visitorLName 
  * @param {*} data 
  * @returns 
  */
 async function generateQRCode(visitorEmpId, visitorEmail, visitorFName, visitorLName, data) {
 
     var qrCode;
 
     // Creating the QR data
     var data = {
         visitorId: visitorEmpId,
         visitorEmail: visitorEmail,
         visitorFirstName: visitorFName,
         visitorLastName: visitorLName,
         qrtype: "digital-clearance-pass",
         conditions: data.supvApprovalRequired,
         entry: data.supvApprovalRequired == "true" ? "granted-with-conditions" : "granted",
         starttime: data.createddate,
         expirytime: data.expirationdate
     }
 
     // Converting the data into String format
     let stringdata = JSON.stringify(data);
 
     try {
 
         return await QRCode.toDataURL(stringdata);
 
     } catch (err) {
 
         console.error('generateQRCode, QRCode generation error: ' + err);
 
         return '';
     }
 
     console.log('generateQRCode ends...');
 }
 
 /**
  * Send email to the visitor with QR code image as an attachemnt
  * 
  * @param {*} expiryDateTime 
  * @param {*} supvApprovalRequired 
  * @param {*} visitorEmail 
  * @param {*} visitorFName 
  * @param {*} visitorLName 
  * @param {*} qrCode 
  * @returns 
  */
 function sendMail(expiryDateTime, supvApprovalRequired, visitorEmail, visitorFName, visitorLName, qrCode) {
 
     if (qrCode === undefined) {
         console.log('sendMail, qrCode is undefined for visitor: ' + visitorEmail);
         return;
     }
 
     console.log('sendMail, supvApprovalRequired: ' + supvApprovalRequired);

    //update the email template here
     var subject = 'Your Digital Clearance Pass for checkin';
     var body = 'Thank you, ' + visitorFName + '.\n'
                + (supvApprovalRequired == 'true' ? 'Please get the necessary approval from your supervisor. You will be required to show your clearance pass as well as your supervisor\'s approval to gain entry into the building\n' : 'You are all set to go to work.\n')
                + 'You can scan your pass at any Digital scanner to mark your presence in the building. \n'
                + 'You are still required to scan your employee badge when entering the office. If your employee badge does not work for any reason, please show your employee badge and clearance pass when requested.\n\n'
                + 'Pass Details: \n'
                + 'Name: ' + visitorFName + ' ' + visitorLName + '\n'
                + 'Conditions: ' + (supvApprovalRequired == 'true' ? 'Pending approval from your supervisor\n' : 'None\n') 
                + 'Valid through: ' + moment(expiryDateTime.toDate()).format('dddd, MMMM Do YYYY, h:mm a') + '\n';
    console.log('sendMail, body: ' + body);

     let transporter = nodemailer.createTransport({
         service: 'gmail',
         auth: {
             type: 'OAuth2',
             user: process.env.MAIL_USERNAME,
             clientId: process.env.MAIL_OAUTH_CLIENTID,
             clientSecret: process.env.MAIL_OAUTH_CLIENT_SECRET,
             refreshToken: process.env.MAIL_OAUTH_REFRESH_TOKEN,
             accessToken: process.env.MAIL_OAUTH_ACCESS_TOKEN
         }
     });
 
     //in test mode, send email to from user configured in app.yaml file
     const receipient = process.env.MODE == 'test' ?  process.env.MAIL_USERNAME : visitorEmail;
 
     let mailOptions = {
         from: process.env.MAIL_USERNAME,
         to: receipient,
         subject: subject,
         text: body,
         attachments: [{ // encoded string as an attachment
             filename: 'digital-pass-qrcode.png',
             content: qrCode.split("base64,")[1],
             encoding: 'base64'
         }]
     };
 
     transporter.sendMail(mailOptions, function(err, data) {
 
         if (err) {
             console.log("sendMail, Error sending email: " + err);
         } else {
             console.log("sendMail, email sent successfully...");
         }
     });
 }
 
 /**
  * Register HTTP POST for listening to webhook calls triggered by DF virtual agent
  */
 app.post('/clearance-pass', async (req, res) => {
 
     let tag = req.body.fulfillmentInfo.tag;
     console.log('dialogflow webhook:', 'Invoked method from Dialogflow CX on tag:' + tag);
 
     // Log ALL of the session parameters passed to the cloud function
     console.log('validateDate sessionInfo parameters', req.body.sessionInfo.parameters);
 
     if (!!tag) {
 
         switch (tag) {
 
             // BEGIN validateAccount using email
             case 'validate-account-using-email':
                 return await validateAccountUsingEmail(req, res);
                 break;
 
                 // BEGIN validateAccount using employee Id
             case 'validate-account-using-empid':
                 return await validateAccountUsingEmpId(req, res);
                 break;
 
                 // BEGIN loadRecentPass for validated employee
             case 'load-recent-pass':
                 return await loadRecentPass(req, res);
                 break;
 
                 // BEGIN loadRecentPass for validated employee
             case 'generate-a-new-pass':
                 return await generatePass(req, res);
                 break;
 
             default:
                 console.log('default case called');
                 return res.status(200).end();
                 break;
         }
     }
 });
 
 // Start the server
 const PORT = process.env.PORT || 8081;
 app.listen(PORT, () => {
     console.log(`App listening on port ${PORT}`);
     console.log('Press Ctrl+C to quit.');
 });
 
 module.exports = app;