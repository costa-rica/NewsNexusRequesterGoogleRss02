const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

function getRequestsParameterArrayFromExcelFile() {
  // Read the workbook
  let workbook;
  try {
    workbook = xlsx.readFile(
      process.env.PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED
    );
  } catch (error) {
    console.error(error);
    return [];
  }
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert the worksheet to JSON
  const jsonData = xlsx.utils.sheet_to_json(worksheet);

  // Map to array of clean query objects
  const queryObjects = jsonData.map((row) => {
    const parsedDate = row.startDate
      ? new Date((row.startDate - 25569) * 86400 * 1000)
          .toISOString()
          .split("T")[0]
      : "";

    return {
      id: row.id,
      andString: row.andString || "",
      orString: row.orString || "",
      notString: row.notString || "",
      dateStartOfRequest: parsedDate || "",
      // includeDomainsArrayString: row.includeDomains || "",
      // excludeDomainsArrayString: row.excludeDomains || "",
    };
  });
  return queryObjects;
}

function writeResponseDataFromNewsAggregator(
  NewsArticleAggregatorSourceId,
  newsApiRequest,
  requestResponseData,
  prefix = false
) {
  // console.log(
  //   "-----> Error and writing into writeResponseDataFromNewsAggregator"
  // );
  const formattedDate = new Date()
    .toISOString()
    .split("T")[0]
    .replace(/-/g, ""); // YYYYMMDD

  const responseDir = process.env.PATH_TO_API_RESPONSE_JSON_FILES;
  const datedDir = path.join(responseDir, formattedDate);

  // ✅ Ensure dated subdirectory exists
  if (!fs.existsSync(datedDir)) {
    fs.mkdirSync(datedDir, { recursive: true });
  } else {
    console.log("-----> datedDir already exists");
  }
  // console.log(
  //   "-----> newsApiRequest ",
  //   JSON.stringify(newsApiRequest, null, 2)
  // );

  // ✅ Remove date from filename
  const responseFilename = prefix
    ? `failed_requestId${newsApiRequest.id}_apiId${NewsArticleAggregatorSourceId}.json`
    : `requestId${newsApiRequest.id}_apiId${NewsArticleAggregatorSourceId}.json`;

  const responseFilePath = path.join(datedDir, responseFilename);

  let jsonToStore = requestResponseData;
  if (newsApiRequest.url) {
    jsonToStore.requestUrl = newsApiRequest.url;
  }

  fs.writeFileSync(
    responseFilePath,
    JSON.stringify(jsonToStore, null, 2),
    "utf-8"
  );
}

module.exports = {
  getRequestsParameterArrayFromExcelFile,
  writeResponseDataFromNewsAggregator,
};
