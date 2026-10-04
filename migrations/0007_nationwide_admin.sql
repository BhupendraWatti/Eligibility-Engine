-- Nationwide jurisdiction masters and persisted recruitment SEO controls.
ALTER TABLE recruitments ADD COLUMN seo_title TEXT;
ALTER TABLE recruitments ADD COLUMN seo_description TEXT;
ALTER TABLE recruitments ADD COLUMN robots_index INTEGER DEFAULT 1 NOT NULL;

INSERT OR IGNORE INTO states (id, code, name, slug, is_active) VALUES
('st_in','IN','Central Government','central-government',1),
('st_ap','AP','Andhra Pradesh','andhra-pradesh',1),('st_ar','AR','Arunachal Pradesh','arunachal-pradesh',1),
('st_as','AS','Assam','assam',1),('st_br','BR','Bihar','bihar',1),('st_cg','CG','Chhattisgarh','chhattisgarh',1),
('st_ga','GA','Goa','goa',1),('st_gj','GJ','Gujarat','gujarat',1),('st_hr','HR','Haryana','haryana',1),
('st_hp','HP','Himachal Pradesh','himachal-pradesh',1),('st_jh','JH','Jharkhand','jharkhand',1),
('st_ka','KA','Karnataka','karnataka',1),('st_kl','KL','Kerala','kerala',1),('st_mp','MP','Madhya Pradesh','madhya-pradesh',1),
('st_mh','MH','Maharashtra','maharashtra',1),('st_mn','MN','Manipur','manipur',1),('st_ml','ML','Meghalaya','meghalaya',1),
('st_mz','MZ','Mizoram','mizoram',1),('st_nl','NL','Nagaland','nagaland',1),('st_od','OD','Odisha','odisha',1),
('st_pb','PB','Punjab','punjab',1),('st_rj','RJ','Rajasthan','rajasthan',1),('st_sk','SK','Sikkim','sikkim',1),
('st_tn','TN','Tamil Nadu','tamil-nadu',1),('st_tg','TG','Telangana','telangana',1),('st_tr','TR','Tripura','tripura',1),
('st_up','UP','Uttar Pradesh','uttar-pradesh',1),('st_uk','UK','Uttarakhand','uttarakhand',1),('st_wb','WB','West Bengal','west-bengal',1),
('st_an','AN','Andaman and Nicobar Islands','andaman-nicobar-islands',1),('st_ch','CH','Chandigarh','chandigarh',1),
('st_dn','DN','Dadra and Nagar Haveli and Daman and Diu','dadra-nagar-haveli-daman-diu',1),('st_dl','DL','Delhi','delhi',1),
('st_jk','JK','Jammu and Kashmir','jammu-kashmir',1),('st_la','LA','Ladakh','ladakh',1),
('st_ld','LD','Lakshadweep','lakshadweep',1),('st_py','PY','Puducherry','puducherry',1);
