var fs = require("fs");
var path = require("path");

var updatedPagesPath = path.join(__dirname,'..','content','.data','updatedPages.json')


module.exports = {

	add:function(shortPath) {
		if(!this.check(shortPath)) {
      var updatedPages = JSON.parse(fs.readFileSync(updatedPagesPath, 'utf8'));
      shortPath = shortPath.replace('.json','.html');
      updatedPages.data.push(shortPath);
      fs.writeFileSync(updatedPagesPath, JSON.stringify(updatedPages));
      return true;
    }
    return false;
	},
	remove:function(shortPath) {
    if(this.check(shortPath)) {
      var updatedPages = JSON.parse(fs.readFileSync(updatedPagesPath, 'utf8'));

      for (var i = 0; i < updatedPages.data.length; i++) {
        if (updatedPages.data[i] === shortPath) {
          updatedPages.data.splice(i, 1);
        }
      }

      fs.writeFileSync(updatedPagesPath, JSON.stringify(updatedPages));
      return true;
    }
    return false;
  },
	check: function(shortPath) {
		// Open the file.

    var fullPath = path.join(__dirname,'..','content', shortPath);

    try {
      fs.accessSync(updatedPagesPath, fs.F_OK);
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.log('Could not fild the file: '+ e.path);
        console.log('Creating file...');
        var date = new Date();
    		var data = {
      		date: date.toJSON(),
      		data: []
    		}
        fs.writeFileSync(updatedPagesPath, JSON.stringify(data));
        console.log('File created...');

      } else {
        console.error(e);
      }
    } finally {

      var updatedPages = JSON.parse(fs.readFileSync(updatedPagesPath, 'utf8'));

      for (var i = 0; i < updatedPages.data.length; i++) {
        if (updatedPages.data[i] === shortPath) {
          return true;
        }
      }
      return false;
    }

  },
  list: function () {
    try {
      fs.accessSync(updatedPagesPath, fs.F_OK);
      var updatedPages = JSON.parse(fs.readFileSync(updatedPagesPath, 'utf8'));
      return updatedPages.data;

    } catch (e) {
      console.error(e);
    }
  },
  clear: function () {
    try {
      fs.accessSync(updatedPagesPath, fs.F_OK);
      var updatedPages = JSON.parse(fs.readFileSync(updatedPagesPath, 'utf8'));
      updatedPages.data = [];
      fs.writeFileSync(updatedPagesPath, JSON.stringify(updatedPages));

    } catch (e) {
      console.error(e);
    }
  }

};
