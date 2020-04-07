import { getContentAsString } from "../../extractor";
import { ExtractAction, ExtractedLayers } from "../../extractor/types";
import { streamToString } from "../../stream-utils";
import { OsReleaseFilePath } from "../../types";

const getOsReleaseAction: ExtractAction = {
  actionName: "os-release",
  fileNamePattern: OsReleaseFilePath.Linux,
  filePathMatches: (filePath) => filePath === OsReleaseFilePath.Linux,
  callback: streamToString,
};

const getFallbackOsReleaseAction: ExtractAction = {
  actionName: "os-release-fallback",
  fileNamePattern: OsReleaseFilePath.LinuxFallback,
  filePathMatches: (filePath) => filePath === OsReleaseFilePath.LinuxFallback,
  callback: streamToString,
};

const getLsbReleaseAction: ExtractAction = {
  actionName: "lsb-release",
  fileNamePattern: OsReleaseFilePath.Lsb,
  filePathMatches: (filePath) => filePath === OsReleaseFilePath.Lsb,
  callback: streamToString,
};

const getDebianVersionAction: ExtractAction = {
  actionName: "debian-version",
  fileNamePattern: OsReleaseFilePath.Debian,
  filePathMatches: (filePath) => filePath === OsReleaseFilePath.Debian,
  callback: streamToString,
};

const getAlpineReleaseAction: ExtractAction = {
  actionName: "alpine-release",
  fileNamePattern: OsReleaseFilePath.Alpine,
  filePathMatches: (filePath) => filePath === OsReleaseFilePath.Alpine,
  callback: streamToString,
};

const getRedHatReleaseAction: ExtractAction = {
  actionName: "redhat-release",
  fileNamePattern: OsReleaseFilePath.RedHat,
  filePathMatches: (filePath) => filePath === OsReleaseFilePath.RedHat,
  callback: streamToString,
};

const getOracleReleaseAction: ExtractAction = {
  actionName: "oracle-release",
  fileNamePattern: OsReleaseFilePath.Oracle,
  filePathMatches: (filePath) => filePath === OsReleaseFilePath.Oracle,
  callback: streamToString,
};

const osReleaseActionMap = {
  [OsReleaseFilePath.Linux]: getOsReleaseAction,
  [OsReleaseFilePath.LinuxFallback]: getFallbackOsReleaseAction,
  [OsReleaseFilePath.Lsb]: getLsbReleaseAction,
  [OsReleaseFilePath.Debian]: getDebianVersionAction,
  [OsReleaseFilePath.Alpine]: getAlpineReleaseAction,
  [OsReleaseFilePath.RedHat]: getRedHatReleaseAction,
  [OsReleaseFilePath.Oracle]: getOracleReleaseAction,
};

export const getOsReleaseActions: ExtractAction[] = [
  getOsReleaseAction,
  getFallbackOsReleaseAction,
  getLsbReleaseAction,
  getDebianVersionAction,
  getAlpineReleaseAction,
  getRedHatReleaseAction,
  getOracleReleaseAction,
];

export function getOsRelease(
  extractedLayers: ExtractedLayers,
  releasePath: OsReleaseFilePath,
): string {
  const osRelease = getContentAsString(
    extractedLayers,
    osReleaseActionMap[releasePath],
  );
  return osRelease || "";
}
