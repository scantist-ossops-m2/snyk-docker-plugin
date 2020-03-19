import * as path from "path";

import * as analyzer from "./analyzer";
import { buildTree } from "./dependency-tree";
import { Docker, DockerOptions } from "./docker";
import * as dockerFile from "./docker-file";
import { tryGetAnalysisError } from "./errors";
import { experimentalAnalysis } from "./experimental";
import { getRuntime } from "./inputs/runtime/docker";
import { parseAnalysisResults } from "./parser";
import { buildResponse } from "./response-builder";
import {
  ManifestFile,
  PluginResponse,
  PluginResponseStatic,
  StaticAnalysisOptions,
} from "./types";

export { inspect, dockerFile };

const MAX_MANIFEST_FILES = 5;

function inspect(
  root: string,
  targetFile?: string,
  options?: any,
): Promise<PluginResponse> {
  const targetImage = root;

  if (options && options.experimental) {
    return experimentalAnalysis(options);
  }

  if (isRequestingStaticAnalysis(options)) {
    return analyzeStatically(targetImage, options);
  }

  return dockerFile
    .readDockerfileAndAnalyse(targetFile)
    .then((dockerfileAnalysis) => {
      return analyzeDynamically(
        targetImage,
        dockerfileAnalysis,
        getDynamicAnalysisOptions(options),
      );
    });
}

async function analyzeDynamically(
  targetImage: string,
  dockerfileAnalysis: dockerFile.DockerFileAnalysis | undefined,
  analysisOptions: any,
): Promise<PluginResponse> {
  const [runtime, dependencies, manifestFiles] = await Promise.all([
    getRuntime(analysisOptions),
    getDependencies(targetImage, dockerfileAnalysis, analysisOptions),
    getManifestFiles(targetImage, analysisOptions),
  ]);

  return buildResponse(
    runtime,
    dependencies,
    dockerfileAnalysis,
    manifestFiles!, // bug in typescript wrongly adds `undefined`
    analysisOptions,
  );
}

async function analyzeStatically(
  targetImage: string,
  options: any,
): Promise<PluginResponse> {
  const staticAnalysisOptions = getStaticAnalysisOptions(options);

  // Relevant only if using a Docker runtime. Optional, but we may consider what to put here
  // to present to the user in Snyk UI.
  const runtime = undefined;
  // Both the analysis and the manifest files are relevant if inspecting a Dockerfile.
  // This is not the case for static scanning.
  const dockerfileAnalysis = undefined;
  const manifestFiles = [];

  try {
    const staticAnalysis = await analyzer.analyzeStatically(
      targetImage,
      staticAnalysisOptions,
    );

    const parsedAnalysisResult = parseAnalysisResults(
      targetImage,
      staticAnalysis,
    );

    const dependenciesTree = await buildTree(
      targetImage,
      parsedAnalysisResult.type,
      parsedAnalysisResult.depInfosList,
      parsedAnalysisResult.targetOS,
    );

    const analysis = {
      package: dependenciesTree,
      packageManager: parsedAnalysisResult.type,
      imageId: parsedAnalysisResult.imageId,
      binaries: parsedAnalysisResult.binaries,
      imageLayers: parsedAnalysisResult.imageLayers,
    };

    // hacking our way through types for backwards compatibility
    const response: PluginResponseStatic = {
      ...buildResponse(
        runtime,
        analysis,
        dockerfileAnalysis,
        manifestFiles,
        staticAnalysisOptions,
      ),
      hashes: [],
    };
    response.hashes = staticAnalysis.binaries;
    return response;
  } catch (error) {
    const analysisError = tryGetAnalysisError(error, targetImage);
    throw analysisError;
  }
}

function isRequestingStaticAnalysis(options?: any): boolean {
  return options && options.staticAnalysisOptions;
}

function getStaticAnalysisOptions(options: any): StaticAnalysisOptions {
  if (
    !options ||
    !options.staticAnalysisOptions ||
    !options.staticAnalysisOptions.imagePath ||
    options.staticAnalysisOptions.imageType === undefined
  ) {
    throw new Error("Missing required parameters for static analysis");
  }

  return {
    imagePath: options.staticAnalysisOptions.imagePath,
    imageType: options.staticAnalysisOptions.imageType,
    tmpDirPath: options.staticAnalysisOptions.tmpDirPath,
  };
}

// TODO: return type should be "DynamicAnalysisOptions" or something that extends DockerOptions
function getDynamicAnalysisOptions(options?: any): any {
  return options
    ? {
        host: options.host,
        tlsverify: options.tlsverify,
        tlscert: options.tlscert,
        tlscacert: options.tlscacert,
        tlskey: options.tlskey,
        manifestGlobs: options.manifestGlobs,
        manifestExcludeGlobs: options.manifestExcludeGlobs,
      }
    : {};
}

async function getDependencies(
  targetImage: string,
  dockerfileAnalysis?: dockerFile.DockerFileAnalysis,
  options?: DockerOptions,
) {
  try {
    const output = await analyzer.analyzeDynamically(
      targetImage,
      dockerfileAnalysis,
      options,
    );
    const result = parseAnalysisResults(targetImage, output);
    const pkg = buildTree(
      targetImage,
      result.type,
      result.depInfosList,
      result.targetOS,
    );

    return {
      package: pkg,
      packageManager: result.type,
      imageId: result.imageId,
      binaries: result.binaries,
      imageLayers: result.imageLayers,
    };
  } catch (error) {
    const analysisError = tryGetAnalysisError(error, targetImage);
    throw analysisError;
  }
}

async function getManifestFiles(
  targetImage: string,
  options?: any,
): Promise<ManifestFile[]> {
  if (!options.manifestGlobs) {
    return [];
  }

  let excludeGlobs: string[] = [];
  if (options.manifestExcludeGlobs) {
    excludeGlobs = options.manifestExcludeGlobs as string[];
  }

  const globs = options.manifestGlobs as string[];
  const docker = new Docker(targetImage, options);

  let files = await docker.findGlobs(globs, excludeGlobs);

  // Limit the number of manifest files which we return
  // to avoid overwhelming the docker daemon with cat requests

  if (files.length > MAX_MANIFEST_FILES) {
    files = files.slice(0, MAX_MANIFEST_FILES);
  }

  const contents = await Promise.all(files.map((f) => docker.catSafe(f)));

  return files
    .map((g, i) => {
      return {
        name: path.basename(g),
        path: path.dirname(g),
        contents: Buffer.from(contents[i].stdout).toString("base64"),
      };
    })
    .filter((i) => i.contents !== "");
}
