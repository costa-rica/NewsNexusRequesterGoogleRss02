const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

async function getRequestsParameterArrayFromExcelFile() {
  // Read the workbook
  let workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(
      process.env.PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED
    );
  } catch (error) {
    console.error(error);
    return [];
  }
  const worksheet = workbook.worksheets[0];

  // Convert the worksheet to JSON manually
  const jsonData = [];
  const headers = {};

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row contains headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value;
      });
    } else {
      // Data rows
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      jsonData.push(rowData);
    }
  });

  // Map to array of clean query objects
  const queryObjects = jsonData.map((row) => {
    let parsedDate = "";
    if (row.startDate) {
      if (row.startDate instanceof Date) {
        // ExcelJS returns Date objects for date cells
        parsedDate = row.startDate.toISOString().split("T")[0];
      } else if (typeof row.startDate === "number") {
        // Fallback: Handle Excel serial numbers (backward compatibility)
        parsedDate = new Date((row.startDate - 25569) * 86400 * 1000)
          .toISOString()
          .split("T")[0];
      }
    }

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
