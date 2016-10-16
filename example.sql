create table primkey (
	id bigint not null,
	hash varchar(40) not null, 
	object varchar(50) not null,
	primary key(id)
);

create table company (
	id bigint not null,
	shortname varchar(30) not null,
	name varchar(100) not null,
	admin boolean not null default false,
	insert_date timestamp, 
	primary key (id),
	unique (shortname)
);

create table user_category (
	id bigint not null,
	identifier varchar not null,
	primary key (id),
	unique (identifier)
);

create table users (
	id bigint not null,
	name varchar(60) not null,
	email varchar(64) not null,
	password varchar(40) not null,
	company_id bigint not null,
	registration_date timestamp not null default current_timestamp,
	active boolean not null default true,
	user_category_id bigint not null, 
	foreign key (company_id) references company (id),
	foreign key (user_category_id) references user_category (id),
	primary key (id),
	unique (email)
);

create table remote_client (
	id bigint not null,
	user_agent varchar(256) not null,
	key varchar(40) not null,
	primary key (id),
	unique (key)
);

create table access_log (
	id bigint not null,
	remote_address varchar(24) not null,
	access_time timestamp not null,
	user_id bigint not null,
	remote_client_id bigint not null,
	key varchar(40) not null, 
	open boolean not null default true,
	primary key (id),
	foreign key (user_id) references users(id),
	foreign key (remote_client_id) references remote_client(id)
);

create view access_log_view as
	select
		access_log.id,
		lpad(to_char(access_log.id, 'FM99999999'::text), 8, '0'::text) as record_id,
		access_log.remote_address,
		access_log.access_time,
		to_char(access_log.access_time, 'DD/MM/YYYY hh24:MI:SS'::text) AS start_time_format,
		access_log.user_id,
		access_log.remote_client_id,
		access_log.key as access_key,
		access_log.open,
		case when access_log.open then 'OPEN' else 'CLOSED' end as access_status,
		users.name as user_name,
		users.email as user_email,
		users.company_id,
		company.name as company,
		company.shortname as company_short,
		company.admin as company_admin,
		users.user_category_id,
		user_category.identifier as user_category,
		remote_client.key as remote_client_key
	from 
		access_log
		inner join users
			on users.id = access_log.user_id
		inner join remote_client
			on remote_client.id = access_log.remote_client_id
		inner join company
			on users.company_id = company.id
		inner join user_category
			on users.user_category_id = user_category.id;

create function access_log_get(_id bigint) returns setof access_log_view as $$
	begin
		return query select * from access_log_view where id = _id;
	end;
$$ language plpgsql;

create function access_login (_email varchar, _password varchar, _remote_address varchar, 
	_remote_client_key varchar, _user_agent varchar) returns bigint as $$
	
	declare
		_remote_client_id bigint;
		_user_id bigint;
		_id bigint;
	begin

		select * from users_login(_email, _password) into _user_id;
		if _user_id < 0 then
			return _user_id;
		end if;

		select * from remote_client_get_id_by_key(_remote_client_key) 
			into _remote_client_id;
		if _remote_client_id is null then
			select * from remote_client_insert(_user_agent) into _remote_client_id;
		end if;

		select * from next_primkey('access_log') into _id;

		insert into access_log values(_id, _remote_address, now(), _user_id, 
				_remote_client_id,  upper(md5(random()::text)), true);

		return _id;

	end;
$$ language plpgsql;

create function access_log_browse (_page int, _limit int, _user_id bigint, 
                                   _latest_date date) returns setof access_log_view as $$	

	declare
		_offset bigint;
	begin
		_offset := (_page - 1) * _limit;

		return query select * from access_log_view
			where (_latest_date is null or _latest_date >= access_time::date) and
				(_user_id is null or _user_id = user_id)
			order by access_time desc offset _offset limit _limit;
	end;
$$ language plpgsql;

create function users_get(_email varchar) returns setof users_view as $$
	begin
		return query select * from users_view where email = _email;
	end;
$$ language plpgsql;
