
/* IMPORT */

import * as fs from 'fs';
import * as path from 'path';
import Limiter from 'promise-concurrency-limiter';
import {Options, Result} from './types';

/* HELPERS */

const limiter = new Limiter ({ concurrency: 500 });

/* TINY READDIR */

const readdir = ( rootPath: string, options?: Options ): Promise<Result> => {

  const maxDepth = options?.depth ?? Infinity,
        isIgnored = options?.ignore ?? (() => false),
        signal = options?.signal ?? { aborted: false },
        directories: string[] = [],
        files: string[] = [],
        resultEmpty: Result = { directories: [], files: [] },
        result: Result = { directories, files };

  const handleDirents = ( rootPath: string, dirents: fs.Dirent[], depth: number ): Promise<(Result | undefined)[]> => {

    return Promise.all ( dirents.map ( ( dirent ): Promise<Result> | undefined => {

      if ( signal.aborted ) return;

      const subPath = path.resolve ( rootPath, dirent.name );

      if ( isIgnored ( subPath ) ) return;

      if ( dirent.isFile () ) {

        files.push ( subPath );

      } else if ( dirent.isDirectory () ) {

        directories.push ( subPath );

        if ( depth >= maxDepth ) return;

        return limiter.add ( () => populateResult ( subPath, depth + 1 ) );

      }

    }));

  };

  const populateResult = async ( rootPath: string, depth: number = 1 ): Promise<Result> => {

    if ( signal.aborted ) return resultEmpty;

    if ( depth > maxDepth ) return result;

    const dirents = await fs.promises.readdir ( rootPath, { withFileTypes: true } ).catch ( () => [] );

    if ( signal.aborted ) return resultEmpty;

    if ( !dirents.length ) return result;

    await handleDirents ( rootPath, dirents, depth );

    if ( signal.aborted ) return resultEmpty;

    return result;

  };

  return populateResult ( rootPath );

};

/* EXPORT */

export default readdir;
