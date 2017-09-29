var path = require("path");
var git = require("nodegit");
var fs = require("fs");

var GitModel = {
	addAndCommit: function(filePath, message, userName, email, callback) {
		
		filePath = path.resolve(filePath);
		
		console.log("Trying to add and commit: " + filePath);
		
		if (!userName) {
			return callback(new Error("Username not provided to commit"));
		}

		if (!message || message.trim() === "") {
			return callback(new Error("No message provided to commit"));
		}

		if (!email) {
			return callback(new Error("Email not provided to commit"));
		}
		
		if (!fs.existsSync(filePath)) {
			return callback(new Error("File does not exist at: " + filePath + ", could not commit"));
		}
		
		var pathContents = filePath.split(path.sep);
		var fileName = pathContents[pathContents.length - 1];

		var repoPath = path.resolve(__dirname, '../content/.git');
		var basePath = path.resolve(__dirname, '../content/');
		
		if (filePath.indexOf(basePath) === 0) {
			filePath = filePath.replace(basePath, "");
		}

		//open a git repo
		git.Repo.open(repoPath, function(openReporError, repo) {
			if (openReporError) {
				return callback(openReporError);
			}

			//add the file to the index...
			repo.openIndex(function(openIndexError, index) {
				if (openIndexError) {
					return callback(openIndexError);
				}

				index.read(function(readError) {
					if (readError) {
						return callback(readError);
					}

					index.addByPath(filePath, function(addByPathError) {
						if (addByPathError) {
							return callback(addByPathError);
						}

						index.write(function(writeError) {
							if (writeError) {
								return callback(writeError);
							}

							index.writeTree(function(writeTreeError, oid) {
								if (writeTreeError) {
									return callback(writeTreeError);
								}

								//get HEAD
								git.Reference.oidForName(repo, 'HEAD', function(oidForName, head) {
									if (oidForName) {
										return callback(oidForName);
									}

									//get latest commit (will be the parent commit)
									repo.getCommit(head, function(getCommitError, parent) {
										if (getCommitError) {
											return callback(getCommitError);
										}
										
										var author = git.Signature.now(userName, email);
										var committer = git.Signature.now(userName, email);

										//commit
										repo.createCommit('HEAD', author, committer, message, oid, [parent], function(error, commitId) {
											if (error) {
												return callback(err);
											}
											
											return callback(null, commitId)
											//console.log("New Commit:", commitId.sha());
										});
									});
								});
							});
						});
					});
				});
			});
		});	
	}
};

module.exports = GitModel;
