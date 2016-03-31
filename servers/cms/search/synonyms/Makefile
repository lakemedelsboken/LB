.PHONY: _pwd_prompt decrypt_conf decrypt_conf_pass encrypt_conf
 
NUMBERS=./mesh_numbers.txt
SYNONYMS=./synonyms.txt
TERMS=./terms.txt

 
_pwd_prompt:
	@echo "Contact generator for the password."
 
# to create unencrypted files
decrypt_conf: _pwd_prompt
	openssl cast5-cbc -d -in ${NUMBERS}.cast5 -out ${NUMBERS}
	chmod 600 ${NUMBERS}
	openssl cast5-cbc -d -in ${SYNONYMS}.cast5 -out ${SYNONYMS}
	chmod 600 ${SYNONYMS}
	openssl cast5-cbc -d -in ${TERMS}.cast5 -out ${TERMS}
	chmod 600 ${TERMS}

# to create unencrypted files
decrypt_conf_pass: _pwd_prompt
	openssl cast5-cbc -d -pass pass:$(PASS) -in ${NUMBERS}.cast5 -out ${NUMBERS}
	chmod 600 ${NUMBERS}
	openssl cast5-cbc -d -pass pass:$(PASS) -in ${SYNONYMS}.cast5 -out ${SYNONYMS}
	chmod 600 ${SYNONYMS}
	openssl cast5-cbc -d -pass pass:$(PASS) -in ${TERMS}.cast5 -out ${TERMS}
	chmod 600 ${TERMS}

# for updating encrypted files.cast5
encrypt_conf: _pwd_prompt
	openssl cast5-cbc -e -in ${NUMBERS} -out ${NUMBERS}.cast5
	openssl cast5-cbc -e -in ${SYNONYMS} -out ${SYNONYMS}.cast5
	openssl cast5-cbc -e -in ${TERMS} -out ${TERMS}.cast5	