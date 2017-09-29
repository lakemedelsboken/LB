var fs = require("fs-extra");
var wrench = require("wrench");
var path = require("path");

var chaptersPath = path.join(__dirname, "..", "content", "kapitel");

var possibleChapters = wrench.readdirSyncRecursive(chaptersPath);

possibleChapters = possibleChapters.filter(function(item) {
	return (path.extname(item) === ".json" && item.indexOf(".snapshots.") === -1 && item.indexOf(".published.") === -1);
});

//console.log(possibleChapters);

//console.log(possibleChapters.length);


var matches = 0;
var count = 0;

var authorsReg = {};

function chapterInfo(chapterPath) {

	var chapter = fs.readJSONSync(chapterPath);

	if (chapter.templateName === "chapter") {
		var authors = [];
		
		for (var i = 0; i < chapter.content.length; i++) {
			if (chapter.content[i].type === "author") {
				authors.push(chapter.content[i]);
			}
		}
		
		authors.forEach(function(item) {
			
			var id = item.content.firstname + " " + item.content.surname + " " + item.content.description;
			
			if (authorsReg[id] === undefined) {
				count++;
				authorsReg[id] = item.content;
				item.content.chapters = [{path: chapterPath.replace(chaptersPath, "").replace(".json", ".html"), name: chapter.title.replace(" | Läkemedelsboken", "")}];
			} else {
				authorsReg[id].chapters.push({path: chapterPath.replace(chaptersPath, "").replace(".json", ".html"), name: chapter.title.replace(" | Läkemedelsboken", "")});
			}

			var description = item.content.description.trim();
			if (description.charAt(description.length - 1) === ",") {
				console.log(chapterPath);
				console.log(item.content.firstname);
				console.log(item.content.surname);
				console.log(item.content.description);
				console.log("\n");
				
				matches++;
			}
		});
		//console.log(authors);
	}
}

for (var i = 0; i < possibleChapters.length; i++) {

	chapterInfo(path.join(chaptersPath, possibleChapters[i]));
	
}

var authorsOld = [
	{
		"id_author" : 827,
		"name" : "Agréus Lars",
		"title" : "Professor, distriktsläkare",
		"department" : "Centrum för allmänmedicin",
		"hospital" : "Karolinska Institutet",
		"city" : "Stockholm"
	},
	{
		"id_author" : 833,
		"name" : "Andén Annika",
		"title" : "Med.dr, allmänläkare",
		"department" : "",
		"hospital" : "Bergnäsets hälsocentral",
		"city" : "Luleå"
	},
	{
		"id_author" : 829,
		"name" : "Andersson Christer",
		"title" : "Professor, distriktsläkare",
		"department" : "",
		"hospital" : "Vårdcentralen Arvidsjaur",
		"city" : "Arvidsjaur"
	},
	{
		"id_author" : 831,
		"name" : "Andersson Liselott",
		"title" : "Med.dr, överläkare, universitetslektor",
		"department" : "Kvinnosjukvården, Klinisk vetenskap, obstetrik och gynekologi, Sunderby sjukhus, Luleå",
		"hospital" : "Umeå universitet",
		"city" : "Umeå"
	},
	{
		"id_author" : 832,
		"name" : "André Malin",
		"title" : "Docent, allmänläkare",
		"department" : "",
		"hospital" : "FFoU-enheten, Primärvården,  Landstinget Uppsala län",
		"city" : "Uppsala"
	},
	{
		"id_author" : 834,
		"name" : "Astermark Jan",
		"title" : "Docent, överläkare",
		"department" : "Hematologi- och koagulationskliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Malmö/Lund"
	},
	{
		"id_author" : 835,
		"name" : "Axelsson Inge",
		"title" : "Professor, överläkare",
		"department" : "Barn- och ungdomskliniken",
		"hospital" : "Östersunds sjukhus",
		"city" : "Östersund"
	},
	{
		"id_author" : 836,
		"name" : "Bárány Peter",
		"title" : "Docent, överläkare",
		"department" : "Njurmedicinska kliniken",
		"hospital" : "Karolinska Universitetssjukhuset",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1072,
		"name" : "Bardage Carola",
		"title" : "Farm.dr, apotekare",
		"department" : "Enheten för läkemedelsanvändning",
		"hospital" : "Läkemedelsverket",
		"city" : "Uppsala"
	},
	{
		"id_author" : 837,
		"name" : "Beermann Björn",
		"title" : "Professor",
		"department" : "",
		"hospital" : "",
		"city" : "Stockholm"
	},
	{
		"id_author" : 838,
		"name" : "Bejerot Susanne",
		"title" : "Docent, överläkare",
		"department" : "Norra Stockholms psykiatri, Karolinska Institutet, Centrum för psykiatriforskning",
		"hospital" : "S:t Görans sjukhus",
		"city" : "Stockholm"
	},
	{
		"id_author" : 840,
		"name" : "Ben-Menachem Elinor",
		"title" : "Professor, överläkare",
		"department" : "Institutionen för klinisk neurovetenskap och fysiologi",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 839,
		"name" : "Bengtsson Olav",
		"title" : "Barn- och ungdomspsykiater, divisionschef",
		"department" : "",
		"hospital" : "BUP-divisionen Stockholm",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1070,
		"name" : "Bergfeldt Lennart",
		"title" : "Professor, överläkare",
		"department" : "Avdelningen för molekylär & klinisk medicin/kardiologi, Institutionen för medicin, Sahlgrenska akademin, Göteborgs universitet ",
		"hospital" : "Verksamhet kardiologi, Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 843,
		"name" : "Berggren Ingela",
		"title" : "Överläkare/bitr. smittskyddsläkare",
		"department" : "",
		"hospital" : "Smittskydd Stockholm, Stockholms läns landsting",
		"city" : "Stockholm"
	},
	{
		"id_author" : 844,
		"name" : "Bergman Bengt",
		"title" : "Docent, överläkare",
		"department" : "Lungmedicin och allergologi",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 845,
		"name" : "Berne Christian",
		"title" : "Professor, överläkare",
		"department" : "Institutionen för medicinska vetenskaper",
		"hospital" : "Akademiska sjukhuset",
		"city" : "Uppsala"
	},
	{
		"id_author" : 846,
		"name" : "Berntorp Erik",
		"title" : "Professor, överläkare",
		"department" : "Lunds universitet, Kliniska vetenskaper,  Malmö",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Malmö"
	},
	{
		"id_author" : 1042,
		"name" : "Birgegård Gunnar",
		"title" : "Professor",
		"department" : "Institutionen för medicinska vetenskaper",
		"hospital" : "Uppsala universitet",
		"city" : "Uppsala"
	},
	{
		"id_author" : 848,
		"name" : "Bixo Marie",
		"title" : "Professor, överläkare",
		"department" : "Karolinska Institutet, Institutionen för klinisk forskning och utbildning, Södersjukhuset",
		"hospital" : "",
		"city" : "Stockholm"
	},
	{
		"id_author" : 849,
		"name" : "Bjellerup Mats",
		"title" : "Docent, överläkare",
		"department" : "Enheten för hudsjukdomar",
		"hospital" : "Helsingborgs lasarett",
		"city" : "Helsingborg"
	},
	{
		"id_author" : 850,
		"name" : "Bjermer Leif",
		"title" : "Professor, överläkare",
		"department" : "Lung- och allergikliniken,  Institutionen för kliniska vetenskaper",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 1036,
		"name" : "Björkander Janne",
		"title" : "Professor, överläkare",
		"department" : "Medicinkliniken",
		"hospital" : "Länssjukhuset Ryhov",
		"city" : "Jönköping"
	},
	{
		"id_author" : 851,
		"name" : "Björkegren Karin",
		"title" : "Universitetslektor, distriktsläkare",
		"department" : "Institutionen för folkhälso- och vårdvetenskap, Allmänmedicin och preventivmedicin",
		"hospital" : "Flogsta vårdcentral",
		"city" : "Uppsala"
	},
	{
		"id_author" : 852,
		"name" : "Björkman Sten",
		"title" : "Överläkare",
		"department" : "Habiliteringen",
		"hospital" : "Blekingesjukhuset",
		"city" : "Karlshamn"
	},
	{
		"id_author" : 854,
		"name" : "Blomström Lundqvist Carina",
		"firstname" : "Carina",
		"lastname" : "Blomström Lundqvist",
		"title" : "Professor",
		"department" : "Kardiologkliniken, Arytmienheten",
		"hospital" : "Akademiska sjukhuset",
		"city" : "Uppsala"
	},
	{
		"id_author" : 1065,
		"name" : "Borgquist Lars",
		"title" : "Professor",
		"department" : "Institutionen för medicin och hälsa",
		"hospital" : "Linköpings universitet",
		"city" : "Linköping"
	},
	{
		"id_author" : 856,
		"name" : "Bosaeus Ingvar",
		"title" : "Professor, överläkare",
		"department" : "Enheten för klinisk nutrition",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 858,
		"name" : "Bridell Gunnel",
		"title" : "Apotekare, chef för receptenheten",
		"department" : "",
		"hospital" : "Apotekens Service AB",
		"city" : "Stockholm"
	},
	{
		"id_author" : 860,
		"name" : "Bućin Dragan",
		"title" : "Docent, överläkare",
		"department" : "Transplantationsenheten, Kirurgiska kliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Malmö"
	},
	{
		"id_author" : 859,
		"name" : "Busch Tobias",
		"title" : "Med.dr, överläkare",
		"department" : "Ögonkliniken",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Mölndal"
	},
	{
		"id_author" : 862,
		"name" : "Calles Helena",
		"title" : "Apotekare, ansvarig för regulatoriska frågor",
		"department" : "Farmaci & Kvalitet",
		"hospital" : "Apotek Hjärtat",
		"city" : "Solna"
	},
	{
		"id_author" : 1066,
		"name" : "Carlsson Per",
		"title" : "Professor",
		"department" : "Avdelningen för hälso- och sjukvårdsanalys",
		"hospital" : "Linköpings universitet",
		"city" : "Linköping"
	},
	{
		"id_author" : 863,
		"name" : "Carlsson Rose-Marie",
		"title" : "Infektionsläkare",
		"department" : "Preventivmedicin- och försvarshälsoavdelningen",
		"hospital" : "Försvarsmedicincentrum",
		"city" : "Västra Frölunda"
	},
	{
		"id_author" : 864,
		"name" : "Carlsten Anders",
		"title" : "Docent, apotekare, direktör VO Användning",
		"department" : "",
		"hospital" : "Läkemedelsverket",
		"city" : "Uppsala"
	},
	{
		"id_author" : 865,
		"name" : "Claeson Per",
		"title" : "Docent, apotekare",
		"department" : "",
		"hospital" : "Läkemedelsverket",
		"city" : "Uppsala"
	},
	{
		"id_author" : 866,
		"name" : "Damber Jan-Erik",
		"title" : "Professor, överläkare",
		"department" : "Avdelningen för urologi,  Institutionen för kliniska vetenskaper",
		"hospital" : "Sahlgrenska akademin vid Göteborgs universitet och Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 868,
		"name" : "Delvert Jörn",
		"title" : " F.d. barnhälsovårdsöverläkare",
		"department" : "Barnhälsovårdsenheten",
		"hospital" : "Söderhamns sjukhus",
		"city" : "Söderhamn"
	},
	{
		"id_author" : 1068,
		"name" : "Dunder Kristina",
		"title" : "Med.dr, specialistläkare",
		"department" : "Läkemedelsverket",
		"hospital" : "",
		"city" : "Uppsala"
	},
	{
		"id_author" : 869,
		"name" : "Eckerdal Gunnar",
		"title" : "Överläkare",
		"department" : "Palliativa teamet",
		"hospital" : "Kungsbacka sjukhus",
		"city" : "Kungsbacka"
	},
	{
		"id_author" : 871,
		"name" : "Edelstam Bo",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Vårby vårdcentral",
		"city" : "Vårby"
	},
	{
		"id_author" : 1053,
		"name" : "Edén Engström Britt",
		"firstname" : "Britt",
		"lastname" : "Eden Engström",
		"title" : "Docent, överläkare",
		"department" : "Sektionen för endokrinologi och diabetes",
		"hospital" : "Akademiska sjukhuset",
		"city" : "Uppsala"
	},
	{
		"id_author" : 872,
		"name" : "Edenwall Hans",
		"title" : "Barnhälsovårdsöverläkare",
		"department" : "BHV-teamet, Hälsovalsenheten,  Landstinget Blekinge",
		"hospital" : "Wämö center",
		"city" : "Karlskrona"
	},
	{
		"id_author" : 1073,
		"name" : "Ekedahl Anders",
		"title" : "Docent, leg. apotekare",
		"department" : "eHälsoinstitutet, Institutionen för medicin och optometri, Linnéuniversitetet, Kalmar",
		"hospital" : "Enheten för Läkemedelsanvändning",
		"city" : "Läkemedelsverket, Uppsala"
	},
	{
		"id_author" : 873,
		"name" : "Ekedahl Staffan",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Hälsans vårdcentral 2",
		"city" : "Jönköping"
	},
	{
		"id_author" : 874,
		"name" : "Ekesbo Rickard",
		"title" : "Med.dr, distriktsläkare",
		"department" : "",
		"hospital" : "Capio Citykliniken",
		"city" : "Malmö"
	},
	{
		"id_author" : 875,
		"name" : "Ekman Elisabet",
		"title" : "Familjeläkare",
		"department" : "",
		"hospital" : "Jämjö vårdcentral",
		"city" : "Jämjö"
	},
	{
		"id_author" : 1041,
		"name" : "Ellegård Lars",
		"title" : "Överläkare",
		"department" : "Enheten för klinisk nutrition",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 876,
		"name" : "Elm Mats",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Vårdvalsenheten",
		"city" : "Göteborg"
	},
	{
		"id_author" : 877,
		"name" : "Engfeldt Peter",
		"title" : "Professor, distriktsläkare",
		"department" : "Allmänmedicinskt forskningscentrum",
		"hospital" : "Örebro läns landsting",
		"city" : "Örebro"
	},
	{
		"id_author" : 1069,
		"name" : "Englund Gunilla",
		"title" : "Farm.dr, apotekare",
		"department" : "Läkemedelsverket",
		"hospital" : "",
		"city" : ""
	},
	{
		"id_author" : 879,
		"name" : "Eriksson Bengt O",
		"firstname" : "Bengt O",
		"lastname" : "Eriksson",
		"title" : "Professor",
		"department" : "Pediatriska institutionen, Sahlgrenska akademin",
		"hospital" : "Drottning Silvias barn- och ungdomssjukhus",
		"city" : "Göteborg"
	},
	{
		"id_author" : 1045,
		"name" : "Eriksson Björn",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Gustavsbergs vårdcentral",
		"city" : "Gustavsberg"
	},
	{
		"id_author" : 880,
		"name" : "Eriksson Karl-Axel",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Vårdcentralen Backa",
		"city" : "Hisings Backa"
	},
	{
		"id_author" : 1047,
		"name" : "Falk Magnus",
		"title" : "Med.dr, specialist i allmänmedicin",
		"department" : "Vårdcentralen Kärna/FoU-enheten för närsjukvården i Östergötland",
		"hospital" : "",
		"city" : "Linköping"
	},
	{
		"id_author" : 881,
		"name" : "Finne Grahnén Anita",
		"firstname" : "Anita",
		"lastname" : "Finne Grahnén",
		"title" : "Sakkunnig patientsäkerhet",
		"department" : "",
		"hospital" : "LIF – de forskande läkemedelsföretagen",
		"city" : "Stockholm"
	},
	{
		"id_author" : 882,
		"name" : "Fornander Tommy",
		"title" : "Docent, överläkare",
		"department" : "Onkologkliniken",
		"hospital" : "Karolinska Universitetssjukhuset, Södersjukhuset",
		"city" : "Stockholm"
	},
	{
		"id_author" : 884,
		"name" : "Franck Johan",
		"title" : "Professor, verksamhetschef",
		"department" : "Beroendecentrum Stockholm",
		"hospital" : "Stockholms läns sjukvårdsområde",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1031,
		"name" : "Frank Öien Rut",
		"firstname" : "Rut",
		"lastname" : "Frank Öien",
		"title" : "Med.dr, distriktsläkare",
		"department" : "Sårcentrum Blekinge",
		"hospital" : "Blekinge kompetenscentrum",
		"city" : "Karlskrona"
	},
	{
		"id_author" : 885,
		"name" : "Fredenberg Sune",
		"title" : "Överläkare",
		"department" : "Röda Korsets vårdförmedling för papperslösa flyktingar",
		"hospital" : "",
		"city" : "Stockholm"
	},
	{
		"id_author" : 886,
		"name" : "Freitag Michael",
		"title" : "Verksamhetschef",
		"department" : "",
		"hospital" : "Ellenbogens hälsocentral",
		"city" : "Malmö"
	},
	{
		"id_author" : 888,
		"name" : "Frisell Jan",
		"title" : "Professor, överläkare",
		"department" : "Karolinska Institutet, Institutionen  för molekylär medicin och kirurgi",
		"hospital" : "Karolinska Universitetssjukhuset, Solna",
		"city" : "Stockholm"
	},
	{
		"id_author" : 889,
		"name" : "Fritz Tomas",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Sickla Hälsocenter",
		"city" : "Nacka"
	},
	{
		"id_author" : 895,
		"name" : "Gårdlund Bengt",
		"title" : "Docent, överläkare",
		"department" : "Infektionskliniken",
		"hospital" : "Karolinska Universitetssjukhuset, Huddinge",
		"city" : "Stockholm"
	},
	{
		"id_author" : 890,
		"name" : "Gilljam Hans",
		"title" : "Professor",
		"department" : "Karolinska Institutet",
		"hospital" : "",
		"city" : "Stockholm"
	},
	{
		"id_author" : 891,
		"name" : "Gisslén Magnus",
		"title" : "Professor, överläkare",
		"department" : "Infektionskliniken",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 893,
		"name" : "Gottsäter Anders",
		"title" : "Docent, överläkare",
		"department" : "Kärlkliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Malmö"
	},
	{
		"id_author" : 894,
		"name" : "Graf Wilhelm",
		"title" : "Professor, överläkare",
		"department" : "Verksamhetsområde kirurgi",
		"hospital" : "Akademiska sjukhuset",
		"city" : "Uppsala"
	},
	{
		"id_author" : 916,
		"name" : "Häggström Lars",
		"title" : "Specialistläkare i psykiatri",
		"department" : "",
		"hospital" : "Psykiatrimottagningen Affecta",
		"city" : "Halmstad"
	},
	{
		"id_author" : 1064,
		"name" : "Håkansson Anders",
		"title" : "Med.dr, leg. läkare",
		"department" : "Beroendecentrum Malmö, Avdelningen för psykiatri, Lunds universitet",
		"hospital" : "Psykiatri Skåne",
		"city" : "Malmö"
	},
	{
		"id_author" : 915,
		"name" : "Håkansson Jan",
		"title" : "Distriktsläkare",
		"department" : "Krokoms hälsocentral",
		"hospital" : "",
		"city" : "Krokom"
	},
	{
		"id_author" : 897,
		"name" : "Hallengren Bengt",
		"title" : "Docent, överläkare",
		"department" : "Endokrinologiska kliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Malmö"
	},
	{
		"id_author" : 898,
		"name" : "Hammarlund-Udenaes Margareta",
		"title" : "Professor",
		"department" : "Institutionen för farmaceutisk biovetenskap",
		"hospital" : "Uppsala universitet",
		"city" : "Uppsala"
	},
	{
		"id_author" : 917,
		"name" : "Hänni Arvo",
		"title" : "Med.dr, överläkare",
		"department" : "",
		"hospital" : "Överviktsenheten, Akademiska sjukhuset, Uppsala",
		"city" : "Viktenheten Skönvik, Säters sjukhus, Säter"
	},
	{
		"id_author" : 899,
		"name" : "Hansson Johan",
		"title" : "Docent, överläkare",
		"department" : "Kliniken för onkologi, Radiumhemmet",
		"hospital" : "Karolinska Universitetssjukhuset, Solna",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1048,
		"name" : "Hansson Sverker",
		"title" : "Docent, överläkare",
		"department" : "Barnmedicin",
		"hospital" : "Drottning Silvias barn- och ungdomssjukhus",
		"city" : "Göteborg"
	},
	{
		"id_author" : 900,
		"name" : "Hansson Tommy",
		"title" : "Professor",
		"department" : "Avdelningen för ortopedi",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 901,
		"name" : "Harper Pauline",
		"title" : "Docent, överläkare",
		"department" : "Porfyricentrum Sverige vid Centrum för medfödda metabola sjukdomar (CMMS)",
		"hospital" : "Karolinska Universitetssjukhuset, Solna",
		"city" : ""
	},
	{
		"id_author" : 902,
		"name" : "Hasselström Jan",
		"title" : "Med.dr, husläkare",
		"department" : "Centrum för allmänmedicin, NVS Karolinska Institutet",
		"hospital" : "Storvretens vårdcentral",
		"city" : "Tumba"
	},
	{
		"id_author" : 903,
		"name" : "Hedberg Charlotte",
		"title" : "Klinisk adjunkt, specialist i allmänmedicin",
		"department" : "CeFam, Centrum för familjemedicin",
		"hospital" : "",
		"city" : "Huddinge"
	},
	{
		"id_author" : 904,
		"name" : "Hedelin Hans",
		"title" : "Docent, överläkare",
		"department" : "",
		"hospital" : "Kungsbacka sjukhus",
		"city" : "Kungsbacka"
	},
	{
		"id_author" : 905,
		"name" : "Hedin Katarina",
		"title" : "Med.dr, specialist i allmänmedicin",
		"department" : "FoU Kronoberg",
		"hospital" : "Landstinget Kronoberg",
		"city" : "Växjö"
	},
	{
		"id_author" : 906,
		"name" : "Heilig Markus",
		"title" : "Clinical Director",
		"department" : "",
		"hospital" : "National Institute on Alcohol Abuse/National Institutes of Health",
		"city" : "Bethesda, USA"
	},
	{
		"id_author" : 907,
		"name" : "Hellström Sten",
		"title" : "Professor, verksamhetschef",
		"department" : "Hörsel- och balanskliniken",
		"hospital" : "Karolinska Universitetssjukhuset, Solna",
		"city" : "Stockholm"
	},
	{
		"id_author" : 908,
		"name" : "Hertervig Erik",
		"title" : "Docent, överläkare",
		"department" : "Gastrokliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 909,
		"name" : "Hesselmar Bill",
		"title" : "Docent, överläkare",
		"department" : "Allergi-CF-Lungcentrum",
		"hospital" : "Drottning Silvias barn- och ungdomssjukhus",
		"city" : "Göteborg"
	},
	{
		"id_author" : 910,
		"name" : "Hetta Jerker",
		"title" : "Professor",
		"department" : "Psykiatri sydväst",
		"hospital" : "Karolinska Universitetssjukhuset",
		"city" : "Stockholm"
	},
	{
		"id_author" : 912,
		"name" : "Hovstadius Bo",
		"title" : "Fil.dr, forskarassistent",
		"department" : "Institutionen för medicin och optometri",
		"hospital" : "Linnéuniversitetet",
		"city" : "Kalmar"
	},
	{
		"id_author" : 913,
		"name" : "Hultcrantz Rolf",
		"title" : "Professor",
		"department" : "Institutionen för medicin, Gastrocentrum Medicin",
		"hospital" : "Karolinska Universitetssjukhuset",
		"city" : "Stockholm"
	},
	{
		"id_author" : 926,
		"name" : "Jägervall Martin",
		"title" : "Överläkare",
		"department" : "Barn- och ungdomskliniken",
		"hospital" : "Centrallasarettet",
		"city" : "Växjö"
	},
	{
		"id_author" : 918,
		"name" : "Janson Christer",
		"title" : "Professor, överläkare",
		"department" : "Lung- och allergikliniken",
		"hospital" : "Akademiska sjukhuset",
		"city" : "Uppsala"
	},
	{
		"id_author" : 919,
		"name" : "Janson Lang Ann Marie",
		"firstname" : "Ann Marie",
		"lastname" : "Janson Lang",
		"title" : "Docent",
		"department" : "Enheten för kliniska prövningar och licenser",
		"hospital" : "Läkemedelsverket",
		"city" : "Uppsala"
	},
	{
		"id_author" : 920,
		"name" : "Jarbin Håkan",
		"title" : "Med.dr, chefsöverläkare",
		"department" : "BUP-kliniken",
		"hospital" : "Psykiatrin i Halland, Hallands sjukhus",
		"city" : "Halmstad"
	},
	{
		"id_author" : 927,
		"name" : "Järhult Bengt",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Vårdcentralen i Ryd",
		"city" : "Ryd"
	},
	{
		"id_author" : 1054,
		"name" : "Johannsson Gudmundur",
		"title" : "Professor, överläkare",
		"department" : "Institutionen för medicin, Sahlgrenska akademin, Göteborgs universitet ",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 922,
		"name" : "Johansson Kurt",
		"title" : "Med.dr",
		"department" : "",
		"hospital" : "",
		"city" : "Stockholm"
	},
	{
		"id_author" : 924,
		"name" : "Johnsson Folke",
		"title" : "Docent",
		"department" : "Kirurgiska kliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 925,
		"name" : "Jontell Mats",
		"title" : "Professor, övertandläkare",
		"department" : "Avdelningen för oral medicin och patologi",
		"hospital" : "Institutionen för odontologi, Sahlgrenska akademin, Göteborgs universitet",
		"city" : "Göteborg"
	},
	{
		"id_author" : 1067,
		"name" : "Jonzon Bror",
		"title" : "",
		"department" : "Docent, specialist i klinisk farmakologi, ämnesområdesansvarig för farmakoterapi",
		"hospital" : "Läkemedelsverket",
		"city" : "Uppsala"
	},
	{
		"id_author" : 1050,
		"name" : "Juliusson Gunnar",
		"title" : "Professor, överläkare",
		"department" : "Hematologi- och koagulationskliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 936,
		"name" : "Källén Ragnar",
		"title" : "Överläkare",
		"department" : "Transplantationsenheten, Kirurgiska kliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Malmö"
	},
	{
		"id_author" : 929,
		"name" : "Karlberg Mikael",
		"title" : "Docent, överläkare",
		"department" : "Öron-, näs- och halskliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 930,
		"name" : "Karling Mats",
		"title" : "",
		"department" : "Avliden",
		"hospital" : "",
		"city" : ""
	},
	{
		"id_author" : 931,
		"name" : "Karlsson Ingvar",
		"title" : "Docent, överläkare",
		"department" : "Institutionen för neurovetenskap",
		"hospital" : "Sahlgrenska akademin, Göteborgs universitet",
		"city" : "Göteborg"
	},
	{
		"id_author" : 932,
		"name" : "Knorring Anne-Liis von",
		"firstname" : "Anne-Liis",
		"lastname" : "von Knorring",
		"title" : "Professor, överläkare",
		"department" : "Barn- och ungdomspsykiatri, Institutionen för neurovetenskap",
		"hospital" : "Akademiska sjukhuset",
		"city" : "Uppsala"
	},
	{
		"id_author" : 933,
		"name" : "Knorring Lars von",
		"firstname" : "Lars",
		"lastname" : "von Knorring",
		"title" : "Professor, överläkare",
		"department" : "Institutionen för neurovetenskap, Psykiatri och verksamhetsområde allmänpsykiatri",
		"hospital" : "Akademiska sjukhuset",
		"city" : "Uppsala"
	},
	{
		"id_author" : 934,
		"name" : "Kragh Annika",
		"title" : "Överläkare i geriatrik",
		"department" : "Närsjukvårdskliniken Hässleholm",
		"hospital" : "Hässleholms sjukhusorganisation",
		"city" : "Hässleholm"
	},
	{
		"id_author" : 935,
		"name" : "Kristiansson Mattias",
		"title" : "Leg. läkare",
		"department" : "",
		"hospital" : "",
		"city" : "Läkarjouren i Norrland AB"
	},
	{
		"id_author" : 937,
		"name" : "Lagerström Folke",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Vivalla vårdcentral",
		"city" : "Örebro"
	},
	{
		"id_author" : 938,
		"name" : "Landerholm Lisa",
		"title" : "Apotekare, medicinsk utredare",
		"department" : "",
		"hospital" : "Tandvårds- och läkemedelsförmånsverket",
		"city" : "Stockholm"
	},
	{
		"id_author" : 939,
		"name" : "Larkö Olle",
		"title" : "Professor",
		"department" : "Hudkliniken",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 940,
		"name" : "Larsson Joakim",
		"title" : "Professor",
		"department" : "Sahlgrenska akademin vid Göteborgs universitet",
		"hospital" : "Institutionen för biomedicin, Avdelningen för infektionssjukdomar",
		"city" : "Göteborg"
	},
	{
		"id_author" : 942,
		"name" : "Liedholm Hans",
		"title" : "Docent, leg. läkare",
		"department" : "",
		"hospital" : "",
		"city" : "Lund"
	},
	{
		"id_author" : 943,
		"name" : "Lind Folke",
		"title" : "Med.dr, överläkare",
		"department" : "Hyperbarmedicin, ANOPIVA-kliniken",
		"hospital" : "Karolinska Universitetssjukhuset, Solna",
		"city" : "Stockholm"
	},
	{
		"id_author" : 945,
		"name" : "Lindell Gert",
		"title" : "Docent, överläkare",
		"department" : "Kirurgiska kliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 946,
		"name" : "Lindemalm Synnöve",
		"title" : "Barnläkare, klinisk farmakolog",
		"department" : "Astrid Lindgrens Barnsjukhus",
		"hospital" : "Karolinska Universitetssjukhuset",
		"city" : "Stockholm"
	},
	{
		"id_author" : 948,
		"name" : "Lindholm Christina",
		"title" : "Professor",
		"department" : "Avdelningen för patientsäkerhet",
		"hospital" : "Karolinska Universitetssjukhuset/Sophiahemmet Högskola",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1057,
		"name" : "Lindkvist Pille",
		"title" : "Specialist infektion och allmänmedicin",
		"department" : "SLL/CeFAM/KI",
		"hospital" : "",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1056,
		"name" : "Lindqvist Lars",
		"title" : "Professor",
		"department" : "Infektionskliniken",
		"hospital" : "Karolinska Universitetssjukhuset",
		"city" : "Stockholm"
	},
	{
		"id_author" : 949,
		"name" : "Lindqvist Rune",
		"title" : "Leg. läkare",
		"department" : "",
		"hospital" : "Tumba vårdcentral",
		"city" : "Tumba"
	},
	{
		"id_author" : 950,
		"name" : "Lindström Kjell",
		"title" : "Med.dr, distriktsläkare",
		"department" : "Primärvårdens FoU-enhet",
		"hospital" : "Futurum",
		"city" : "Jönköping"
	},
	{
		"id_author" : 952,
		"name" : "Ljung Rolf",
		"title" : "Professor, överläkare",
		"department" : "",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Barnmedicinska kliniken Malmö/Lund"
	},
	{
		"id_author" : 954,
		"name" : "Ljunggren Östen",
		"title" : "Professor, överläkare",
		"department" : "Institutionen för medicinska vetenskaper",
		"hospital" : "Akademiska sjukhuset",
		"city" : "Uppsala"
	},
	{
		"id_author" : 958,
		"name" : "Lööf Lars",
		"title" : "Professor, överläkare",
		"department" : "",
		"hospital" : "Läkemedelskommittén, Landstinget Västmanland",
		"city" : "Västerås"
	},
	{
		"id_author" : 1075,
		"name" : "Lundberg Anna",
		"title" : "Affärsansvarig/produktansvarig DOS",
		"department" : "Apoteket AB",
		"hospital" : "",
		"city" : ""
	},
	{
		"id_author" : 955,
		"name" : "Lundqvist Anders",
		"title" : "Specialist i allmänmedicin",
		"department" : "",
		"hospital" : "Vårdcentralen Näsby",
		"city" : "Kristianstad"
	},
	{
		"id_author" : 956,
		"name" : "Lycke Jan",
		"title" : "Docent, överläkare",
		"department" : "Neurologiska kliniken",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 959,
		"name" : "Magnil Maria",
		"title" : "Specialist i allmänmedicin",
		"department" : "",
		"hospital" : "Capio, Husläkarna",
		"city" : "Kungsbacka"
	},
	{
		"id_author" : 960,
		"name" : "Magnusson Per",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Järpens hälsocentral",
		"city" : "Järpen"
	},
	{
		"id_author" : 967,
		"name" : "Mårild Staffan",
		"title" : "Docent, överläkare",
		"department" : "Barnmedicin",
		"hospital" : "Drottning Silvias barn- och ungdomssjukhus",
		"city" : "Göteborg"
	},
	{
		"id_author" : 963,
		"name" : "Marktorp Caroline",
		"title" : "Överläkare, sektionschef",
		"department" : "Geriatrik- och strokesektionen, Medicinkliniken",
		"hospital" : "Centralsjukhuset",
		"city" : "Kristianstad"
	},
	{
		"id_author" : 970,
		"name" : "Mätzsch Thomas",
		"title" : "Docent, överläkare",
		"department" : "Kirurgiska kliniken, Kärlenheten",
		"hospital" : "Kärnsjukhuset Skövde",
		"city" : "Skövde"
	},
	{
		"id_author" : 964,
		"name" : "Midlöv Patrik",
		"title" : "Docent, distriktsläkare",
		"department" : "",
		"hospital" : "Vårdcentralen Tåbelund",
		"city" : "Eslöv"
	},
	{
		"id_author" : 911,
		"name" : "Hoffmann Mikael",
		"title" : "Överläkare i klinisk farmakologi",
		"department" : "NEPI – Stiftelsen nätverk för läkemedelsepidemiologi",
		"hospital" : "Universitetssjukhuset i Linköping",
		"city" : "Linköping"
	},
	{
		"id_author" : 965,
		"name" : "Milsom Ian",
		"title" : "Professor, överläkare",
		"department" : "Kvinnokliniken",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 966,
		"name" : "Mobacken Håkan",
		"title" : "Docent",
		"department" : "",
		"hospital" : "Sahlgrenska akademin",
		"city" : "Göteborg"
	},
	{
		"id_author" : 971,
		"name" : "Mölstad Sigvard",
		"title" : "Professor",
		"department" : "Institutionen för kliniska vetenskaper",
		"hospital" : "Lunds universitet",
		"city" : "Malmö"
	},
	{
		"id_author" : 1063,
		"name" : "Msghina Mussie",
		"title" : "Docent, överläkare",
		"department" : "Institutionen för klinisk neurovetenskap ",
		"hospital" : "Karolinska Universitetssjukhuset, Huddinge",
		"city" : "Stockholm"
	},
	{
		"id_author" : 980,
		"name" : "Näslund Inger",
		"title" : "Överläkare",
		"department" : "",
		"hospital" : "Vuxenhabiliteringen, CSK",
		"city" : "Karlstad"
	},
	{
		"id_author" : 972,
		"name" : "Nilsson Christer",
		"title" : "Överläkare",
		"department" : "Anestesikliniken",
		"hospital" : "Blekingesjukhuset",
		"city" : "Karlskrona"
	},
	{
		"id_author" : 974,
		"name" : "Nived Ola",
		"title" : "Docent, överläkare",
		"department" : "Reumatologiska kliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 1046,
		"name" : "Norberg Margareta",
		"title" : "Allmänläkare",
		"department" : "Staben för verksamhetsutveckling, Västerbottens läns landsting",
		"hospital" : "",
		"city" : "Umeå"
	},
	{
		"id_author" : 975,
		"name" : "Nordling Marianne",
		"title" : "Leg. apotekare",
		"department" : "",
		"hospital" : "Apotekens Service AB",
		"city" : "Stockholm"
	},
	{
		"id_author" : 977,
		"name" : "Norman Christer",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Salems vårdcentral",
		"city" : "Rönninge"
	},
	{
		"id_author" : 1038,
		"name" : "Nydert Per",
		"title" : "Apotekare",
		"department" : "Neonatalverksamheten",
		"hospital" : "Karolinska Universitetssjukhuset",
		"city" : "Stockholm"
	},
	{
		"id_author" : 978,
		"name" : "Nyman Jane",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Närhälsan Backa vårdcentral",
		"city" : "Hisings Backa"
	},
	{
		"id_author" : 979,
		"name" : "Nyström Fredrik",
		"title" : "Professor i internmedicin, överläkare",
		"department" : "Avdelningen för kardiovaskulär medicin, IMH",
		"hospital" : "Hälsouniversitetet i Linköping",
		"city" : "Linköping"
	},
	{
		"id_author" : 1037,
		"name" : "Odebäck Peter",
		"title" : "Distriktsläkare",
		"department" : "Skagerns Vård och Hälsoenhet",
		"hospital" : "Medicinsk rådgivare inom Capio närsjukvård",
		"city" : "Gullspång"
	},
	{
		"id_author" : 981,
		"name" : "Odeberg Håkan",
		"title" : "Docent",
		"department" : "Landstinget Blekinge kompetenscentrum",
		"hospital" : "",
		"city" : "Karlskrona"
	},
	{
		"id_author" : 982,
		"name" : "Odenholt Inga",
		"title" : "Professor, överläkare",
		"department" : "Infektionskliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Malmö"
	},
	{
		"id_author" : 983,
		"name" : "Odlind Viveca",
		"title" : "Professor, senior expert",
		"department" : "",
		"hospital" : "Läkemedelsverket",
		"city" : "Uppsala"
	},
	{
		"id_author" : 984,
		"name" : "Ohlsson Bodil",
		"title" : "Professor, överläkare",
		"department" : "",
		"hospital" : "Kliniska vetenskaper, Avdelningen för internmedicin",
		"city" : "Malmö"
	},
	{
		"id_author" : 985,
		"name" : "Olsson Ingrid",
		"title" : "Docent, överläkare",
		"department" : "Barn- och ungdomsneurologi",
		"hospital" : "Drottning Silvias barn- och ungdomssjukhus, Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 987,
		"name" : "Peeker Ralph",
		"title" : "Professor, överläkare",
		"department" : "Verksamhet urologi",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 988,
		"name" : "Pelling Henrik",
		"title" : "Överläkare",
		"department" : "BUP-kliniken",
		"hospital" : "Akademiska sjukhuset",
		"city" : "Uppsala"
	},
	{
		"id_author" : 989,
		"name" : "Personne Mark",
		"title" : "Överläkare",
		"department" : "",
		"hospital" : "Giftinformationscentralen",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1044,
		"name" : "Persson Hans",
		"title" : "Docent, överläkare",
		"department" : "Hjärtkliniken ",
		"hospital" : "Danderyds sjukhus",
		"city" : "Stockholm"
	},
	{
		"id_author" : 990,
		"name" : "Persson Ingemar",
		"title" : "Professor, senior expert",
		"department" : "",
		"hospital" : "Läkemedelsverket",
		"city" : "Uppsala"
	},
	{
		"id_author" : 991,
		"name" : "Persson Jerker",
		"title" : "Vet.med.dr, överläkare, områdeschef",
		"department" : "Område 1 (Medicinklinikerna, Akutkliniken, Infektionskliniken)",
		"hospital" : "Hallands sjukhus",
		"city" : "Halmstad/Varberg"
	},
	{
		"id_author" : 992,
		"name" : "Persson Nils H",
		"firstname" : "Nils H",
		"lastname" : "Persson",
		"title" : "Docent",
		"department" : "",
		"hospital" : "",
		"city" : "Malmö"
	},
	{
		"id_author" : 993,
		"name" : "Rane Anders",
		"title" : "Professor",
		"department" : "Avdelningen för klinisk farmakologi, Karolinska Institutet",
		"hospital" : "Karolinska Universitetssjukhuset, Huddinge",
		"city" : "Stockholm"
	},
	{
		"id_author" : 994,
		"name" : "Reichard Olle",
		"title" : "Docent, överläkare",
		"department" : "Infektionskliniken",
		"hospital" : "Karolinska Universitetssjukhuset",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1074,
		"name" : "Ring Lena",
		"title" : "Professor, forskare",
		"department" : "Enheten för Läkemedelsanvändning",
		"hospital" : "Läkemedelsverket",
		"city" : "Uppsala"
	},
	{
		"id_author" : 1052,
		"name" : "Rönnmark Christina",
		"title" : "Specialist i allmänmedicin",
		"department" : "",
		"hospital" : "",
		"city" : "Uppsala"
	},
	{
		"id_author" : 996,
		"name" : "Saartok Tönu",
		"title" : "Med.dr, leg. läkare",
		"department" : "Ortopedkliniken",
		"hospital" : "Visby lasarett",
		"city" : "Visby"
	},
	{
		"id_author" : 1051,
		"name" : "Salminen Helena",
		"title" : "Med.dr, lektor i allmänmedicin",
		"department" : "Centrum för allmänmedicin, NVS",
		"hospital" : "Karolinska Institutet",
		"city" : "Stockholm"
	},
	{
		"id_author" : 998,
		"name" : "Samuelsson Eva",
		"title" : "Docent, distriktsläkare",
		"department" : "Institutionen för folkhälsa och klinisk medicin, Umeå universitet, regionaliserad läkarutbildning och Krokoms hälsocentral",
		"hospital" : "",
		"city" : "Östersund"
	},
	{
		"id_author" : 999,
		"name" : "Sandberg Torsten",
		"title" : "Docent, överläkare",
		"department" : "Infektionskliniken",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 1000,
		"name" : "Sandeberg Anna-Maria af",
		"firstname" : "Anna-Maria",
		"lastname" : "af Sandeberg",
		"title" : "Överläkare, verksamhetschef",
		"department" : "",
		"hospital" : "Stockholms centrum för ätstörningar",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1002,
		"name" : "Schulman Sam",
		"title" : "Professor, överläkare",
		"department" : "",
		"hospital" : "Department of Medicine, McMaster University",
		"city" : "HHS-General Hospital, Hamilton, Canada"
	},
	{
		"id_author" : 1003,
		"name" : "Schwan Åke",
		"title" : "Med.dr, distriktsläkare",
		"department" : "",
		"hospital" : "Landstingets kansli, Läkemedelsenheten",
		"city" : "Uppsala"
	},
	{
		"id_author" : 1039,
		"name" : "Silfverdal Sven-Arne",
		"title" : "Docent, barnhälsovårdsöverläkare",
		"department" : "Institutionen för klinisk vetenskap, pediatrik, Umeå universitet",
		"hospital" : "Barnhälsovårdsenheten, Norrlands universitetssjukhus",
		"city" : "Umeå"
	},
	{
		"id_author" : 1004,
		"name" : "Stagmo Martin",
		"title" : "Med.dr, överläkare",
		"department" : "Kliniken för hjärtsvikt och klaffsjukdomar",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 1008,
		"name" : "Ställberg Björn",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Gagnefs vårdcentral",
		"city" : "Gagnef"
	},
	{
		"id_author" : 1005,
		"name" : "Stattin Urban",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Alvesta vårdcentral",
		"city" : "Alvesta"
	},
	{
		"id_author" : 1006,
		"name" : "Stenberg Anna Märta",
		"firstname" : "Anna Märta",
		"lastname" : "Stenberg",
		"title" : "",
		"department" : "",
		"hospital" : "",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1007,
		"name" : "Sturfelt Gunnar",
		"title" : "Professor, överläkare",
		"department" : "Reumatologiska kliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 1009,
		"name" : "Sydow Helen von",
		"firstname" : "Helen",
		"lastname" : "von Sydow",
		"title" : "Specialist i allmänmedicin, regionläkare",
		"department" : "VG Primärvårdskontoret, Regionens Hus",
		"hospital" : "",
		"city" : "Göteborg"
	},
	{
		"id_author" : 1012,
		"name" : "Thulesius Hans",
		"title" : "Docent, distriktsläkare",
		"department" : "",
		"hospital" : "Vårdcentralen Strandbjörket, FoU Kronoberg",
		"city" : "Växjö"
	},
	{
		"id_author" : 1013,
		"name" : "Truedsson Lennart",
		"title" : "Professor, överläkare",
		"department" : "Klinisk immunologi och transfusionsmedicin",
		"hospital" : "Labmedicin Skåne",
		"city" : "Lund"
	},
	{
		"id_author" : 1014,
		"name" : "Truedsson Mikael",
		"title" : "Distriktsläkare",
		"department" : "",
		"hospital" : "Örestadskliniken",
		"city" : "Malmö"
	},
	{
		"id_author" : 1015,
		"name" : "Tunbäck Petra",
		"title" : "Överläkare",
		"department" : "Verksamheten för hud- och könssjukvård",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 1043,
		"name" : "Tydén Patrik",
		"title" : "Överläkare",
		"department" : "HIA, Kranskärlskliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 1016,
		"name" : "Tørring Ove",
		"title" : "Docent, överläkare, universitetslektor",
		"department" : "Institutionen för klinisk forskning och utbildning, Karolinska Institutet ",
		"hospital" : "Sektionen för endokrinologi, VO Internmedicin, Södersjukhuset",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1017,
		"name" : "Uvebrant Paul",
		"title" : "Professor, överläkare",
		"department" : "Barn- och ungdomsneurologi",
		"hospital" : "Drottning Silvias barn- och ungdomssjukhus, Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 1020,
		"name" : "Vinge Ellen",
		"title" : "Docent, specialist i klinisk farmakologi",
		"department" : "Läkemedelssektionen",
		"hospital" : "Landstingets kansli",
		"city" : "Kalmar"
	},
	{
		"id_author" : 1021,
		"name" : "Waldenlind Elisabet",
		"title" : "Docent, överläkare",
		"department" : "Neurologiska kliniken",
		"hospital" : "Karolinska Universitetssjukhuset, Huddinge",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1023,
		"name" : "Werner Sonja",
		"title" : "Överläkare, allergolog",
		"department" : "Lung- och allergikliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 1024,
		"name" : "Wester Per",
		"title" : "Professor, överläkare",
		"department" : "Strokecenter, Medicincentrum resp.  Institutionen för folkhälsa och klinisk medicin",
		"hospital" : "Norrlands universitetssjukhus resp. Umeå universitet",
		"city" : "Umeå"
	},
	{
		"id_author" : 1035,
		"name" : "Westlin Dan",
		"title" : "Specialistläkare internmedicin och kardiologi",
		"department" : "Toraxcentrum ",
		"hospital" : "Blekingesjukhuset",
		"city" : "Karlskrona"
	},
	{
		"id_author" : 1025,
		"name" : "Wettermark Maria",
		"title" : "Leg. apotekare",
		"department" : "",
		"hospital" : "Apotekens Service AB",
		"city" : "Stockholm"
	},
	{
		"id_author" : 1026,
		"name" : "Widner Håkan",
		"title" : "Professor, överläkare",
		"department" : "Neurologiska kliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Lund"
	},
	{
		"id_author" : 1027,
		"name" : "Wiklund Olov",
		"title" : "Professor",
		"department" : "Sahlgrenska akademin, Göteborgs universitet",
		"hospital" : "Sahlgrenska Universitetssjukhuset",
		"city" : "Göteborg"
	},
	{
		"id_author" : 1028,
		"name" : "Wullt Marlene",
		"title" : "Docent, överläkare",
		"department" : "Infektionskliniken",
		"hospital" : "Skånes universitetssjukhus",
		"city" : "Malmö"
	},
	{
		"id_author" : 1029,
		"name" : "Zethelius Björn",
		"title" : "Docent, specialist i internmedicin och diabetologi",
		"department" : "",
		"hospital" : "Läkemedelsverket",
		"city" : "Uppsala"
	},
	{
		"id_author" : 1030,
		"name" : "Åstrand Bengt",
		"title" : "Docent, leg. apotekare",
		"department" : "Institutionen för kemi och biomedicin",
		"hospital" : "Linnéuniversitetet",
		"city" : "Kalmar"
	}
];

//for (var i = authorsOld.length - 1; i >= 0; i--) {
//	var id = authorsOld[i]
//}


for (var key in authorsReg) {
	var item = authorsReg[key];
	//console.log(item)

	var remove = false;

	for (var i = authorsOld.length - 1; i >= 0; i--) {
		if (authorsOld[i].name === (item.surname + " " + item.firstname)) {
			authorsOld.splice(i, 1);
			remove = true;
			//break;
		}
	}
	
	if (remove) {
		//delete authorsReg[key];
	}

}
//console.log(authorsReg);


if (authorsOld.length > 0) {

	console.log(authorsOld.length)

	console.log(Object.keys(authorsReg).length);

	console.log(authorsOld)

	console.log("")

	console.log(authorsReg);
	
} else {
	//console.log(authorsReg);
	var alphabetically = {};

	var authorsArray = [];

	for (var key in authorsReg) {
		
		var item = authorsReg[key];

		authorsArray.push(item);
	}

	authorsArray.sort(function(a, b){
	    if(a.surname < b.surname) return -1;
	    if(a.surname > b.surname) return 1;
	    return 0;
	})

	authorsArray.forEach(function(item) {

		var firstLetter = item.surname.charAt(0).toUpperCase();
		
		if (alphabetically[firstLetter] === undefined) {
			alphabetically[firstLetter] = [];
		}
		
		alphabetically[firstLetter].push(item);
	});
	
	//console.log(alphabetically);

	console.log("<ul class=\"nav nav-pills\" id=\"authorsRegistryLetterIndex\">")
	for (var key in alphabetically) {
		console.log("\t<li><a title=\"Gå till författare vars efternamn börjar med " + key + "\" href=\"#" + key + "\">" + key + "</a></li>");
	}
	console.log("</ul>")

	for (var key in alphabetically) {
		console.log("<h4 id=\"" + key + "\">" + key + "</h4>");
		console.log("<ul class=\"authorsByLetter\">");

		alphabetically[key].forEach(function(item) {
			console.log("<li><article>");
			console.log("<strong>" + item.firstname + " " + item.surname + "</strong><br>" + item.description);
			
			console.log("<ul>");
			item.chapters.forEach(function(chapter) {
				console.log("<li>");
				console.log("<a href=\"{pre}/kapitel" + chapter.path + "\">" + chapter.name + " <i class=\"fa fa-angle-double-right\"></i></a>");
				console.log("</li>");
			});
			console.log("</ul>");
			
			console.log("</article></li>");
		});

		console.log("</ul>");
	}	
	
}

//chapterInfo(path.join(chaptersPath, possibleChapters[0]));