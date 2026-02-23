insert into skills (skill_name) values 
('Mathematics'),
('Physics'),
('Chemistry'),
('Biology'),
('Computer Science'),
('English Literature'),
('History'),
('Economics'),
('Psychology'),
('Philosophy');
('Art'),
('Music'),
('Foreign Languages'),
('Engineering'),
('Medicine'),
('Law'),
('Business'),
('Finance'),
('Statistics'),
('Data Science')
on conflict (skill_name) do nothing; -- to avoid duplicate entries if we run the seed multiple times