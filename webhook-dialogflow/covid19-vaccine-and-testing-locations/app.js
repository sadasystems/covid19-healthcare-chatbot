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
 
 const nodeGeocoder = require('node-geocoder');
 let options = {
     provider: 'openstreetmap'
 };
 const geoCoder = nodeGeocoder(options);
 
 const axios = require('axios');
 const express = require('express');
 const bodyParser = require('body-parser')
 const app = express();
 
 app.use(bodyParser.json())
 app.use(bodyParser.urlencoded({
     extended: true
 }))
 
 /**
  * Find Testing locations nearby the location provided by the user. 
  * a. Convert the provided location to latitude and longitude
  * b. Call SF data APIs to find testing centers nearby 20 miles of location provide by the customer
  * c. Build the custom rich card for testing centers and booking appointment
  * 
  * @param {*} req 
  * @param {*} res 
  * @returns 
  */
 async function findTestingCenters(req, res) {
 
     // supporting variables
     var returnResponse = {
         "fulfillmentResponse": {
             "messages": []
         },
         "sessionInfo": {
             "parameters": {}
         }
     }
     var testingCentersFound = 'false';
     var latitude;
     var longitude;
     var serviceAPIError = 'false';
 
     //read session attributes
     let preferredLocation = req.body.sessionInfo.parameters.preferred_location;
 
     console.log('findTestingCenters was triggered on location: ' + preferredLocation.original);
 
     // convert address provided by the user into geo-coordinates
     const result = await geoCoder.geocode(preferredLocation.original);
     console.log('findTestingCenters geo-coordinates: ' + result);
 
     // if geo-conversion is susccesful, length will be atleast 1.
     if (result.length > 0) {
 
         console.log('findTestingCenters geo-coordinates: latitude/longitude: ' + result[0].latitude + ':' + result[0].longitude);
 
         // read latitude and longitude
         latitude = result[0].latitude;
         longitude = result[0].longitude;
 
         //find testing centers around user provided geolocation (in SF region only)
         let url = process.env.COVID19_TESTING_CENTER_API + '?' +
             '$select=*&$limit=' + process.env.MAX_NUMBER_OF_LOCATIONS_TO_FETCH + '&$where=within_circle(point, ' + latitude + ', ' + longitude + ', ' +
             process.env.COVID19_TESTING_CENTER_RADIUS_METERS +
             ')';
         console.log('findTestingCenters, API url: ' + url);
 
         // make sure to configure the authorization bearer token in app.yaml file
         var config = {
             method: 'get',
             url: url,
             headers: {
                 'Authorization': process.env.COVID19_TESTING_CENTER_API_BEARER_TOKEN
             }
         };
         console.log('findTestingCenters, API url config: ' + config);
 
         // Call SF data APIs to find the first 3 test centers nearby the user's address
         await axios(config)
             .then(function(response) {
 
                 console.log('findTestingCenters response, testingCenters count: ' + response.data.length);
                 console.log('findTestingCenters response, testingCenters: ' + JSON.stringify(response.data));
 
                 if ((response.data !== null) && (response.data.length > 0)) {
 
                     //testing location found
                     testingCentersFound = 'true';
 
                     //save count
                     let testingCentersCount = response.data.length;
 
                     returnResponse.fulfillmentResponse.messages.push({
                         "text": {
                             "text": [testingCentersCount + " coronavirus testing center(s) within " + process.env.COVID19_TESTING_CENTER_RADIUS_MILES + " miles of: " + preferredLocation.original]
                         }
                     });
 
                     //set DF messenger rich cards as custom payload
                     for (var i = 0; i < testingCentersCount; i++) {
 
                         let testingCenter = response.data[i];
 
                         returnResponse.fulfillmentResponse.messages.push({
                             "payload": {
                                 "richContent": [
                                     [{
                                             "type": "list",
                                             "title": testingCenter.name,
                                             "subtitle": testingCenter.address
                                         },
                                         {
                                             "type": "description",
                                             "text": [
                                                 "Testing Hours: " + testingCenter.testing_hours,
                                                 "Phone Number: " + testingCenter.phone_number_formatted,
                                                 "Eligibility: " + testingCenter.eligibility,
                                                 "CTA Text: " + testingCenter.cta_text,
                                                 "Location Type: " + testingCenter.location_type,
                                                 "Site: " + testingCenter.popup_or_permanent
                                             ]
                                         }
                                     ]
                                 ]
                             }
                         });
                     }
                 }
             })
             .catch(function(error) {
                 console.log('findTestingCenters, response error message: ' + error);
 
                 //indicate that the SF data api failed for some reason. please make sure auth token is configured properly in the app.yaml file
                 serviceAPIError = 'true';
             });
 
     } else {
         console.log('findTestingCenters unable to convert the user location into geo-coordinates...');
     }
 
     //push testing ceneters found or not attribute
     returnResponse.sessionInfo.parameters["testing_centers_found"] = testingCentersFound;
 
     //save preferred geolocation into session for later use (if needed)
     returnResponse.sessionInfo.parameters["preferred_location_latitude"] = latitude === undefined ? null : latitude;
     returnResponse.sessionInfo.parameters["preferred_location_longitude"] = longitude === undefined ? null : longitude;
     returnResponse.sessionInfo.parameters["service_api_error"] = serviceAPIError;
 
     console.log('findTestingCenters sending response back to Dialogflow: ' + JSON.stringify(returnResponse));
 
     //send response to DF virtual agent
     return res.status(200).send(returnResponse);
 }
 
 /**
  * Find Vaccine access points nearby the location provided by the user. 
  * a. Convert the provided location to latitude and longitude
  * b. Call SF data APIs to find vaccine points nearby 20 miles of location provide by the customer
  * c. Build the custom rich card for access points and booking appointment
  * 
  * @param {*} req 
  * @param {*} res 
  * @returns 
  */
 async function findVaccineAccessPoints(req, res) {
 
     // supporting variables
     var returnResponse = {
         "fulfillmentResponse": {
             "messages": []
         },
         "sessionInfo": {
             "parameters": {}
         }
     }
     var vaccineAccessPointsFound = 'false';
     var latitude;
     var longitude;
     var serviceAPIError = 'false';
 
     //read session attributes
     let preferredLocation = req.body.sessionInfo.parameters.preferred_location;
     let dropinOnly = req.body.sessionInfo.parameters.drop_in_only;
     let wheelchairAccessibleOnly = req.body.sessionInfo.parameters.wheelchair_accessible_only;
 
     console.log('findVaccineAccessPoints was triggered on location: ' + preferredLocation.original);
 
     // convert address provided by the user into geo-coordinates
     const result = await geoCoder.geocode(preferredLocation.original);
     console.log('findVaccineAccessPoints geo-coordinates: ' + result);
 
     // if geo-conversion is susccesful, length will be atleast 1.
     if (result.length > 0) {
 
         console.log('findVaccineAccessPoints geo-coordinates: latitude/longitude: ' + result[0].latitude + ':' + result[0].longitude);
 
         // read latitude and longitude
         latitude = result[0].latitude;
         longitude = result[0].longitude;
 
         //find vaccine access points around user provided geolocation (in SF region only)
         let url = process.env.COVID19_VACCINE_ACCESS_POINTS_API + '?' +
             '$select=*' + '&$limit=' +
             process.env.MAX_NUMBER_OF_LOCATIONS_TO_FETCH +
             '&$where=within_circle(shape, ' + latitude + ', ' + longitude + ', ' + process.env.COVID19_VACCINE_ACCESS_POINTS_RADIUS_METERS + ')';
 
         if (dropinOnly == 'true') {
             url += " AND dropins_allowed='Yes'";
         }
         if (wheelchairAccessibleOnly == 'true') {
             url += " AND wheelchair_accessible='Yes'";
         }
         console.log('findVaccineAccessPoints, API url: ' + url);
 
         // make sure to configure the authorization bearer token in app.yaml file
         var config = {
             method: 'get',
             url: url,
             headers: {
                 'Authorization': process.env.COVID19_VACCINE_ACCESS_POINTS_API_BEARER_TOKEN
             }
         };
         console.log('findVaccineAccessPoints, API url config: ' + config);
 
         // Call SF data APIs to find the first 3 vaccine access points nearby the user's address
         await axios(config)
             .then(function(response) {
 
                 console.log('findVaccineAccessPoints response, testingCenters count: ' + response.data.length);
                 console.log('findVaccineAccessPoints response, testingCenters: ' + JSON.stringify(response.data));
 
                 if ((response.data !== null) && (response.data.length > 0)) {
 
                     //testing location found
                     vaccineAccessPointsFound = 'true';
 
                     //save count
                     let vaccineAccessPointsCount = response.data.length;
 
                     //create a text response
                     returnResponse.fulfillmentResponse.messages.push({
                         "text": {
                             "text": [vaccineAccessPointsCount + " vaccine access point(s) within " + process.env.COVID19_VACCINE_ACCESS_POINTS_RADIUS_MILES + " miles of: " + preferredLocation.original]
                         }
                     });
 
                     //set DF messenger rich cards as custom payload
                     for (var i = 0; i < vaccineAccessPointsCount; i++) {
 
                         let vaccineAccessPoint = response.data[i];
 
                         returnResponse.fulfillmentResponse.messages.push({
                             "payload": {
                                 "richContent": [
                                     [{
                                             "type": "list",
                                             "title": vaccineAccessPoint.site_name,
                                             "subtitle": vaccineAccessPoint.location_address + ", " + vaccineAccessPoint.location_city + " " + vaccineAccessPoint.zip_code
                                         },
                                         {
                                             "type": "description",
                                             "text": [
                                                 "Dropins Allowed: " + vaccineAccessPoint.dropins_allowed,
                                                 "Access Mode: " + vaccineAccessPoint.access_mode,
                                                 "Wheelchair Accessible: " + vaccineAccessPoint.wheelchair_accessible,
                                                 "Vaccine Provider: " + vaccineAccessPoint.vaccine_provider
                                             ]
                                         },
                                         {
                                             "type": "button",
                                             "icon": {
                                                 "type": "chevron_right",
                                                 "color": "#FF9800"
                                             },
                                             "text": "Book Appointment",
                                             "link": vaccineAccessPoint.booking_url,
                                             "event": {
                                                 "name": "",
                                                 "languageCode": "",
                                                 "parameters": {}
                                             }
                                         }
                                     ]
                                 ]
                             }
                         });
                     }
                 }
             })
             .catch(function(error) {
                 console.log('findVaccineAccessPoints, response error message: ' + error);
 
                 //indicate that the SF data api failed for some reason. please make sure auth token is configured properly in the app.yaml file
                 serviceAPIError = 'true';
             });
 
     } else {
         console.log('findVaccineAccessPoints unable to convert the user location into geo-coordinates...');
     }
 
     //push vaccine access points found attribute in session parameters
     returnResponse.sessionInfo.parameters["vaccine_access_points_found"] = vaccineAccessPointsFound;
 
     //save preferred geolocation into session for later use (if needed)
     returnResponse.sessionInfo.parameters["preferred_location_latitude"] = latitude === undefined ? null : latitude;
     returnResponse.sessionInfo.parameters["preferred_location_longitude"] = longitude === undefined ? null : longitude;
     returnResponse.sessionInfo.parameters["service_api_error"] = serviceAPIError;
 
     console.log('findVaccineAccessPoints sending response back to Dialogflow: ' + JSON.stringify(returnResponse));
 
     //send response to DF virtual agent
     return res.status(200).send(returnResponse);
 }
 
 /**
  * Register HTTP POST for listening to webhook calls triggered by DF virtual agent
  */
 app.post('/covid19-locations', async (req, res) => {
 
     let tag = req.body.fulfillmentInfo.tag;
     console.log('dialogflow locations webhook:', 'Invoked method from Dialogflow CX on tag:' + tag);
 
     // Log ALL of the session parameters passed to the cloud function
     console.log('covid19-locations sessionInfo parameters', req.body.sessionInfo.parameters);
 
     if (!!tag) {
 
         switch (tag) {
 
             // BEGIN findTestingCenters from customer provided location
             case 'find-testing-centers':
                 return await findTestingCenters(req, res);
                 break;
 
                 // BEGIN findVaccineAccessPoints from customer provided location
             case 'find-vaccine-access-points':
                 return await findVaccineAccessPoints(req, res);
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